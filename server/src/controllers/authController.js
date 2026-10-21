const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateSecret, generateURI, verify: verifyTotp } = require('otplib');
const QRCode = require('qrcode');
const { hashIdentifier, recordAuditEvent } = require('../utils/auditLog');
const { getPangasinanZipCode } = require('../utils/pangasinanLocations');
const policies = require('../../../shared/legalPolicies.json');
const { loginProtection, normalizeLoginEmail } = require('../services/loginProtection');
const { createPasswordResetUrl, passwordResetEmail } = require('../utils/passwordResetEmail');
// Match the existing bcrypt cost without giving unknown identifiers a cheaper password path.
const dummyLoginHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
const MFA_TOKEN_TTL = '5m';
const MFA_ENROLLMENT_TTL_MS = 10 * 60 * 1000;

function mfaEncryptionKey() {
  const key = Buffer.from(String(process.env.MFA_ENCRYPTION_KEY || ''), 'base64');
  if (key.length !== 32) throw Object.assign(new Error('MFA encryption is not configured.'), { code: 'MFA_CONFIGURATION_ERROR' });
  return key;
}

function encryptMfaSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', mfaEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptMfaSecret(value) {
  const [ivValue, tagValue, ciphertextValue] = String(value || '').split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw Object.assign(new Error('MFA secret is invalid.'), { code: 'MFA_CONFIGURATION_ERROR' });
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', mfaEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw Object.assign(new Error('MFA secret cannot be read.'), { code: 'MFA_CONFIGURATION_ERROR' });
  }
}

const mfaChallenge = (user, purpose) => jwt.sign({ id: user._id, purpose, mfa: true }, process.env.JWT_SECRET, { expiresIn: MFA_TOKEN_TTL });
function mfaChallengeUser(token, purpose) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (!payload?.mfa || payload.purpose !== purpose || !payload.id) throw new Error('MFA_CHALLENGE_INVALID');
  return payload.id;
}
const normalizeRecoveryCode = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const recoveryHash = (value) => crypto.createHash('sha256').update(normalizeRecoveryCode(value)).digest('hex');
const createRecoveryCodes = () => Array.from({ length: 8 }, () => {
  const code = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `${code.slice(0, 6)}-${code.slice(6, 12)}-${code.slice(12, 18)}-${code.slice(18)}`;
});

async function loginPayload(user, message = 'Logged in successfully.') {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const loginTime = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: loginTime, updatedAt: loginTime } });
  return { message, token, user: {
    id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email,
    role: user.role, status: user.status, isVerified: user.isVerified,
    address: user.address, jurisdiction: user.jurisdiction, mfaEnabled: true
  } };
}

const EMAIL_SEND_TIMEOUT_MS = 15 * 1000;
const includeErrorDetails = process.env.NODE_ENV === 'development';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const developmentErrorDetails = (error) => (includeErrorDetails ? {
  error: {
    name: error.name,
    code: error.code || null,
    message: error.message
  }
} : {});

const sameCity = (first, second) => (
  Boolean(first && second) && first.trim().toLowerCase() === second.trim().toLowerCase()
);

const canLGUManagePersonnel = (requester, personnel) => (
  personnel.role === 'barangay_personnel'
  && sameCity(requester.jurisdiction?.municipalityOrCity, personnel.jurisdiction?.municipalityOrCity)
);

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;
const brevoSenderName = process.env.BREVO_SENDER_NAME || 'SafeLink';

const sendMailWithDeadline = async (mailOptions) => {
  if (!brevoApiKey || !brevoSenderEmail) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_SEND_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        sender: { email: brevoSenderEmail, name: brevoSenderName },
        to: [{ email: mailOptions.to }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html,
        ...(mailOptions.text ? { textContent: mailOptions.text } : {})
      })
    });

    if (!response.ok) {
      const error = new Error('Email delivery failed.');
      error.code = 'EMAIL_DELIVERY_FAILED';
      error.status = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Email delivery timed out.');
      timeoutError.code = 'EMAIL_SEND_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const resendAttempts = new Map();
const RESEND_COOLDOWN_MS = 60 * 1000;
const genericResendMessage = 'If an unverified Citizen account exists for that email, a verification message will be sent.';

const createVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
    expires: Date.now() + 15 * 60 * 1000
  };
};

const sendVerificationEmail = (user, verificationToken) => {
  const verifyUrl = `${clientUrl}/activate-account?token=${verificationToken}`;
  return sendMailWithDeadline({
    to: user.email,
    subject: 'Verify Your SafeLink Citizen Account',
    html: `
      <div style="background:#f3f7f8;padding:32px 16px;font-family:Arial,sans-serif;color:#17324d">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #dbe7ea">
          <p style="margin:0 0 8px;color:#087d85;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SafeLink</p>
          <h2 style="margin:0 0 16px;color:#102f4f">Activate your Citizen account</h2>
          <p>Welcome to SafeLink, ${user.firstName}. Confirm your email address to activate your account.</p>
          <p>This activation link is valid for 15 minutes.</p>
          <p style="margin:28px 0">
            <a href="${verifyUrl}" target="_blank" style="display:inline-block;background:#087d85;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px">Activate my SafeLink account</a>
          </p>
          <p style="font-size:13px;color:#587086">If the button does not open, copy the link address from the button and paste it into your browser.</p>
          <p style="font-size:13px;color:#587086">If you didn't create this account, you can safely ignore this email.</p>
        </div>
      </div>
    `
  });
};

const emailDeliveryError = (res, extra = {}) => res.status(503).json({
  code: 'EMAIL_DELIVERY_FAILED',
  message: 'The account information was saved, but SafeLink could not send the email. Please try again shortly.',
  retryable: true,
  ...extra
});

// @desc    Register a standard Citizen account (Requires Email Verification)
// @route   POST /api/auth/register-citizen
const registerCitizen = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, password, phoneNumber, address } = req.body;
    const email = req.body.email.toLowerCase().trim();

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verification = createVerificationToken();

    user = new User({
      firstName,
      lastName,
      middleInitial: middleInitial || '',
      email,
      password: hashedPassword,
      phoneNumber,
      address: {
        ...address,
        zipCode: getPangasinanZipCode(address.municipalityOrCity)
      },
      role: 'citizen',
      legalAcceptance: { termsVersion: policies.termsVersion, privacyVersion: policies.privacyVersion, acceptedAt: new Date() },
      status: 'pending',
      isVerified: false,
      emailVerificationToken: verification.hash,
      emailVerificationExpires: verification.expires
    });

    await user.save();

    await recordAuditEvent({
      req,
      targetUser: user._id,
      action: 'AUTH_CITIZEN_REGISTERED',
      outcome: 'success'
    });

    try {
      await sendVerificationEmail(user, verification.token);
      return res.status(201).json({
        message: 'Citizen account created successfully. Please check your email to verify your account before logging in.',
        accountCreated: true,
        verificationEmailSent: true
      });
    } catch (mailError) {
      console.error('Verification email delivery error:', mailError.message);
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_VERIFICATION_EMAIL_FAILED', outcome: 'failure' });
      return emailDeliveryError(res, { accountCreated: true, verificationEmailSent: false });
    }
  } catch (err) {
    console.error('Citizen registration error:', err.message);
    res.status(500).json({
      message: 'Server error during citizen registration.',
      ...developmentErrorDetails(err)
    });
  }
};

// @desc    Resend a Citizen email-verification link without exposing account existence
// @route   POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+mfaSecret +mfaPendingSecret +mfaRecoveryCodeHashes');
    if (!user || user.role !== 'citizen' || user.isVerified) {
      return res.status(200).json({ message: genericResendMessage });
    }

    const resendKey = hashIdentifier(email);
    const lastAttempt = resendAttempts.get(resendKey) || 0;
    const remaining = RESEND_COOLDOWN_MS - (Date.now() - lastAttempt);
    if (remaining > 0) {
      res.set('Retry-After', String(Math.ceil(remaining / 1000)));
      return res.status(429).json({
        code: 'RESEND_COOLDOWN',
        message: 'Please wait before requesting another verification email.'
      });
    }
    resendAttempts.set(resendKey, Date.now());

    const verification = createVerificationToken();
    user.emailVerificationToken = verification.hash;
    user.emailVerificationExpires = verification.expires;
    await user.save();

    try {
      await sendVerificationEmail(user, verification.token);
      resendAttempts.set(resendKey, Date.now());
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_VERIFICATION_EMAIL_RESENT', outcome: 'success' });
      return res.status(200).json({ message: genericResendMessage });
    } catch (mailError) {
      resendAttempts.set(resendKey, Date.now());
      console.error('Verification resend delivery error:', mailError.message);
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_VERIFICATION_EMAIL_FAILED', outcome: 'failure' });
      return emailDeliveryError(res, { accountCreated: true, verificationEmailSent: false });
    }
  } catch (error) {
    console.error('Verification resend error:', error.message);
    return res.status(500).json({ message: 'Server error requesting a verification email.' });
  }
};

// @desc    Verify a citizen's email address via emailed token
// @route   GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({ emailVerificationToken: hashedToken });

    if (!user) {
      const verifiedUser = await User.findOne({
        lastUsedEmailVerificationToken: hashedToken,
        lastUsedEmailVerificationExpires: { $gt: Date.now() },
        isVerified: true
      }).select('+lastUsedEmailVerificationToken +lastUsedEmailVerificationExpires');
      if (verifiedUser) {
        return res.status(409).json({
          code: 'ALREADY_VERIFIED',
          message: 'This Citizen account is already verified.'
        });
      }
      return res.status(400).json({
        code: 'VERIFICATION_TOKEN_INVALID',
        message: 'This verification token is invalid.'
      });
    }
    if (user.isVerified) {
      return res.status(409).json({
        code: 'ALREADY_VERIFIED',
        message: 'This Citizen account is already verified.'
      });
    }
    if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() <= Date.now()) {
      return res.status(410).json({
        code: 'VERIFICATION_TOKEN_EXPIRED',
        message: 'This verification token has expired.'
      });
    }

    // Email verification cannot lift an administrative access restriction.
    if (user.role !== 'citizen' || !['pending', 'active'].includes(user.status)) {
      return res.status(403).json({
        code: 'ACCOUNT_RESTRICTED',
        message: 'This account cannot be activated. Contact your account administrator.'
      });
    }
    // Guard the transition in the database as well as above: a concurrent
    // suspension or token replacement must not be overwritten by verification.
    const activatedUser = await User.findOneAndUpdate({
      _id: user._id,
      role: 'citizen',
      isVerified: false,
      status: { $in: ['pending', 'active'] },
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    }, {
      $set: {
        isVerified: true,
        status: 'active',
        lastUsedEmailVerificationToken: hashedToken,
        lastUsedEmailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000),
        updatedAt: new Date()
      },
      $unset: { emailVerificationToken: '', emailVerificationExpires: '' }
    }, { new: true, runValidators: true });
    if (!activatedUser) {
      return res.status(409).json({
        code: 'VERIFICATION_STATE_CHANGED',
        message: 'This verification link can no longer activate the account. Request a new link or contact your account administrator.'
      });
    }

    await recordAuditEvent({
      req,
      actor: user._id,
      targetUser: user._id,
      action: 'AUTH_EMAIL_VERIFIED',
      outcome: 'success'
    });

    res.status(200).json({
      code: 'ACCOUNT_ACTIVATED',
      message: 'Account activated successfully. Your SafeLink Citizen account is now verified and ready to use.'
    });
  } catch (err) {
    console.error('Email verification error:', err.message);
    res.status(500).json({ message: 'Server error during email verification.' });
  }
};

// @desc    Register Personnel (Barangay, LGU, Police, Admin) - Restricted to Admins/LGU
// @route   POST /api/auth/register-personnel
const registerPersonnel = async (req, res) => res.status(410).json({ message: 'Personnel accounts must be created through Administrator Personnel Management.' });

// Historical application records remain intact; no new public applications are accepted.
const applyPersonnel = async (req, res) => res.status(410).json({ message: 'Public personnel applications are closed. Contact your System Administrator.' });

// @desc    Authenticate and Login User/Personnel
// @route   POST /api/auth/login
function loginCooldown(res, seconds) {
  const minutes = Math.ceil(seconds / 60);
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ code: 'LOGIN_LOCKED', retryAfterSeconds: seconds,
    message: `Too many unsuccessful login attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` });
}

async function invalidLoginPassword(req, res, attempt, user, email) {
  const failure = await attempt.recordFailure();
  await recordAuditEvent({ req, targetUser: user?._id || null, action: 'AUTH_LOGIN', outcome: 'failure',
    details: { reason: 'invalid_credentials', attemptedEmailHash: hashIdentifier(email) } });
  if (failure.started) await recordAuditEvent({ req, targetUser: user?._id || null, action: 'AUTH_ACCOUNT_LOCKED', outcome: 'failure',
    details: { reason: 'account_locked', cooldownSeconds: failure.cooldownSeconds } });
  return failure.locked ? loginCooldown(res, Math.max(1, attempt.remainingSeconds())) : res.status(400).json({ message: 'Invalid credentials.' });
}

const loginUser = async (req, res) => {
  let attempt;
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { password } = req.body;
    const email = normalizeLoginEmail(req.body.email);
    attempt = await loginProtection.acquire(email);
    if (attempt.remainingSeconds()) {
      await recordAuditEvent({ req, action: 'AUTH_LOGIN', outcome: 'failure', details: { reason: 'account_locked' } });
      return loginCooldown(res, Math.max(1, attempt.remainingSeconds()));
    }

    const user = await User.findOne({ email });
    // Verify the password before exposing any account-status information.
    const passwordMatches = await bcrypt.compare(password, user?.password || dummyLoginHash);
    if (!user || !passwordMatches) return await invalidLoginPassword(req, res, attempt, user, email);

    if (!user.isVerified) {
      await recordAuditEvent({
        req,
        targetUser: user._id,
        action: 'AUTH_LOGIN',
        outcome: 'failure',
        details: { reason: 'account_not_verified' }
      });
      if (user.role === 'citizen') {
        return res.status(403).json({
          message: 'Please check your email and verify your account before logging in.'
        });
      } else {
        return res.status(403).json({
          message: 'Your account is pending administrator approval.'
        });
      }
    }

    if (user.status !== 'active') {
      await recordAuditEvent({
        req,
        targetUser: user._id,
        action: 'AUTH_LOGIN',
        outcome: 'failure',
        details: { reason: user.status === 'suspended' ? 'account_suspended' : 'account_not_verified' }
      });
      return res.status(403).json({ message: user.status === 'suspended' ? 'Access denied. Your account has been suspended. Contact your account administrator.' : 'Your account is pending administrator approval.' });
    }

    // Only a verified, active account with a correct password reaches this reset.
    await attempt.reset();
    if (!user.mfaEnabled) {
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_MFA_ENROLLMENT_REQUIRED', outcome: 'success' });
      return res.json({ mfaEnrollmentRequired: true, mfaToken: mfaChallenge(user, 'enroll'), email: user.email,
        message: 'Set up your authenticator app to finish signing in.' });
    }
    await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_MFA_REQUIRED', outcome: 'success' });
    return res.json({ mfaRequired: true, mfaToken: mfaChallenge(user, 'login'), email: user.email,
      message: 'Enter the code from your authenticator app to finish signing in.' });
  } catch (err) {
    console.error('LOGIN_FAILED', err.code || err.name);
    if (err.code === 'LOGIN_BUSY') {
      res.setHeader('Retry-After', '1');
      return res.status(429).json({ code: 'LOGIN_BUSY', retryAfterSeconds: 1, message: 'Sign-in is being processed. Please try again shortly.' });
    }
    if (err.code === 'LOGIN_STATE_UNAVAILABLE') {
      return res.status(503).json({ code: 'SERVER_ERROR', message: 'SafeLink sign-in is temporarily unavailable. Please try again later.' });
    }
    res.status(500).json({ message: 'Server error during login.' });
  } finally {
    if (attempt) await attempt.release().catch(() => console.error('LOGIN_LEASE_RELEASE_FAILED'));
  }
};

async function mfaUser(token, purpose, select = '') {
  const id = mfaChallengeUser(token, purpose);
  const user = await User.findById(id).select(select);
  if (!user || !user.isVerified || user.status !== 'active') throw new Error('MFA_CHALLENGE_INVALID');
  return user;
}

// The setup challenge is issued only after a correct password. Its short expiry
// prevents a QR code from becoming an independent long-lived credential.
const beginMfaEnrollment = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await mfaUser(req.body.mfaToken, 'enroll');
    if (user.mfaEnabled) return res.status(409).json({ code: 'MFA_ALREADY_ENABLED', message: 'Authenticator MFA is already enabled for this account.' });
    const secret = generateSecret();
    const uri = generateURI({ issuer: 'SafeLink', label: user.email, secret });
    const expires = new Date(Date.now() + MFA_ENROLLMENT_TTL_MS);
    await User.updateOne({ _id: user._id, mfaEnabled: false }, { $set: { mfaPendingSecret: encryptMfaSecret(secret), mfaPendingExpires: expires, updatedAt: new Date() } });
    const qrCodeDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
    return res.json({ qrCodeDataUrl, manualEntryKey: secret, expiresAt: expires.toISOString(), issuer: 'SafeLink' });
  } catch (error) {
    if (error.code === 'MFA_CONFIGURATION_ERROR') return res.status(503).json({ code: error.code, message: 'Authenticator setup is temporarily unavailable.' });
    return res.status(401).json({ code: 'MFA_CHALLENGE_INVALID', message: 'Your MFA setup session has expired. Sign in again to continue.' });
  }
};

const confirmMfaEnrollment = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await mfaUser(req.body.mfaToken, 'enroll', '+mfaPendingSecret +mfaRecoveryCodeHashes');
    if (user.mfaEnabled || !user.mfaPendingSecret || !user.mfaPendingExpires || user.mfaPendingExpires <= new Date()) {
      return res.status(400).json({ code: 'MFA_ENROLLMENT_EXPIRED', message: 'This authenticator setup has expired. Sign in again to create a new QR code.' });
    }
    const secret = decryptMfaSecret(user.mfaPendingSecret);
    const result = await verifyTotp({ secret, token: req.body.code });
    if (!result.valid) return res.status(400).json({ code: 'MFA_CODE_INVALID', message: 'That authenticator code is incorrect. Try the current code.' });
    const recoveryCodes = createRecoveryCodes();
    const updated = await User.findOneAndUpdate({ _id: user._id, mfaEnabled: false, mfaPendingExpires: { $gt: new Date() } }, {
      $set: { mfaEnabled: true, mfaSecret: user.mfaPendingSecret, mfaRecoveryCodeHashes: recoveryCodes.map(recoveryHash), mfaEnabledAt: new Date(), updatedAt: new Date() },
      $unset: { mfaPendingSecret: '', mfaPendingExpires: '' }
    }, { new: true }).select('+mfaSecret +mfaRecoveryCodeHashes');
    if (!updated) return res.status(409).json({ code: 'MFA_ENROLLMENT_CHANGED', message: 'This MFA setup is no longer available. Sign in again to continue.' });
    await recordAuditEvent({ req, actor: updated._id, targetUser: updated._id, action: 'AUTH_MFA_ENROLLED', outcome: 'success' });
    return res.json({ ...(await loginPayload(updated, 'Authenticator MFA is enabled.')), recoveryCodes });
  } catch (error) {
    if (error.code === 'MFA_CONFIGURATION_ERROR') return res.status(503).json({ code: error.code, message: 'Authenticator setup is temporarily unavailable.' });
    return res.status(401).json({ code: 'MFA_CHALLENGE_INVALID', message: 'Your MFA setup session has expired. Sign in again to continue.' });
  }
};

const verifyMfaLogin = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await mfaUser(req.body.mfaToken, 'login', '+mfaSecret');
    if (!user.mfaEnabled || !user.mfaSecret) return res.status(401).json({ code: 'MFA_NOT_ENABLED', message: 'Authenticator MFA is not enabled for this account.' });
    const result = await verifyTotp({ secret: decryptMfaSecret(user.mfaSecret), token: req.body.code });
    if (!result.valid) {
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_MFA_LOGIN', outcome: 'failure', details: { reason: 'invalid_totp' } });
      return res.status(400).json({ code: 'MFA_CODE_INVALID', message: 'That authenticator code is incorrect. Try the current code.' });
    }
    await recordAuditEvent({ req, actor: user._id, targetUser: user._id, action: 'AUTH_MFA_LOGIN', outcome: 'success' });
    return res.json(await loginPayload(user));
  } catch (error) {
    if (error.code === 'MFA_CONFIGURATION_ERROR') return res.status(503).json({ code: error.code, message: 'Authenticator verification is temporarily unavailable.' });
    return res.status(401).json({ code: 'MFA_CHALLENGE_INVALID', message: 'Your MFA sign-in session has expired. Sign in again to continue.' });
  }
};

const recoverMfaLogin = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const user = await mfaUser(req.body.mfaToken, 'login', '+mfaRecoveryCodeHashes');
    const codeHash = recoveryHash(req.body.recoveryCode);
    if (!user.mfaEnabled || !user.mfaRecoveryCodeHashes?.includes(codeHash)) {
      await recordAuditEvent({ req, targetUser: user._id, action: 'AUTH_MFA_RECOVERY', outcome: 'failure' });
      return res.status(400).json({ code: 'MFA_RECOVERY_INVALID', message: 'That recovery code is invalid or has already been used.' });
    }
    const consumed = await User.updateOne({ _id: user._id, mfaRecoveryCodeHashes: codeHash }, { $pull: { mfaRecoveryCodeHashes: codeHash }, $set: { updatedAt: new Date() } });
    if (!consumed.modifiedCount) return res.status(400).json({ code: 'MFA_RECOVERY_INVALID', message: 'That recovery code is invalid or has already been used.' });
    await recordAuditEvent({ req, actor: user._id, targetUser: user._id, action: 'AUTH_MFA_RECOVERY', outcome: 'success' });
    return res.json(await loginPayload(user, 'Recovery code accepted. Store your remaining recovery codes safely.'));
  } catch {
    return res.status(401).json({ code: 'MFA_CHALLENGE_INVALID', message: 'Your MFA sign-in session has expired. Sign in again to continue.' });
  }
};

// @desc    Return the current authenticated account and authorization scope
// @route   GET /api/auth/me
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('_id firstName lastName middleInitial email phoneNumber role address jurisdiction status isVerified createdAt');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error fetching the current account.' });
  }
};

// @desc    Get all personnel accounts pending verification
// @route   GET /api/auth/pending-personnel
const getPendingPersonnel = async (req, res) => {
  try {
    const query = { isVerified: false, role: { $ne: 'citizen' } };
    if (req.user.role === 'lgu_personnel') {
      query.role = 'barangay_personnel';
      query['jurisdiction.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    }

    const pendingUsers = await User.find(query).select('_id firstName lastName middleInitial email role jurisdiction phoneNumber status isVerified createdAt');

    res.json(pendingUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching pending accounts.' });
  }
};

// @desc    Approve a personnel account
// @route   PUT /api/auth/approve-personnel/:id
const approvePersonnel = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role === 'citizen') {
      return res.status(400).json({ message: 'Citizen accounts must be verified through their email link.' });
    }

    if (req.user.role === 'lgu_personnel' && !canLGUManagePersonnel(req.user, user)) {
      return res.status(403).json({ message: 'LGU personnel can approve barangay personnel only within their municipality or city.' });
    }

    if (user.isVerified && user.status === 'active') {
      return res.status(400).json({ message: 'Personnel account is already approved.' });
    }

    user.isVerified = true;
    user.status = 'active';
    await user.save();

    await recordAuditEvent({
      req,
      targetUser: user._id,
      action: 'PERSONNEL_APPROVED',
      outcome: 'success',
      details: { role: user.role }
    });

    res.json({ message: `Account for ${user.firstName} ${user.lastName} has been approved successfully.` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during account approval.' });
  }
};

// @desc    Request password reset link/token
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = createPasswordResetUrl({ token: resetToken });

    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const mailOptions = {
      to: user.email,
      ...passwordResetEmail({ firstName: user.firstName, resetUrl }),
    };

    try {
      await sendMailWithDeadline(mailOptions);
    } catch (emailError) {
      // SMTP errors may include message contents, reset URLs, or credentials.
      console.error('PASSWORD_RESET_EMAIL_DELIVERY_FAILED');
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(503).json({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'SafeLink could not send the password-reset email. Please try again shortly.',
        retryable: true,
      });
    }

    res.status(200).json({ message: 'Password reset instructions sent to your email.' });
  } catch (err) {
    console.error('PASSWORD_RESET_EMAIL_FAILED');
    res.status(500).json({ message: 'Server error sending password reset email.' });
  }
};

// @desc    Reset a user's password using the emailed token
// @route   POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await recordAuditEvent({
      req,
      actor: user._id,
      targetUser: user._id,
      action: user.role === 'lgu_personnel' ? 'LGU_PASSWORD_RESET' : 'AUTH_PASSWORD_RESET_COMPLETED',
      outcome: 'success'
    });

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('PASSWORD_RESET_FAILED');
    res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// @desc    Update user account status with hierarchical permission checks
// @route   PATCH /api/auth/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const requester = req.user;

    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value provided.' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    if (requester.role === 'admin') {
    }
    else if (requester.role === 'lgu_personnel') {
      if (targetUser.role === 'citizen') {
        if (!sameCity(requester.jurisdiction?.municipalityOrCity, targetUser.address?.municipalityOrCity)) {
          return res.status(403).json({ message: 'Permission denied: You can only manage citizens in your municipality or city.' });
        }
      } else if (!canLGUManagePersonnel(requester, targetUser)) {
        return res.status(403).json({
          message: 'Permission denied: LGU personnel can manage barangay personnel only within their municipality or city.'
        });
      }
    }
    else {
      return res.status(403).json({
        message: 'Access forbidden: You do not have administrative privileges.'
      });
    }

    if (status === 'active' && targetUser.role === 'citizen' && !targetUser.isVerified) {
      return res.status(400).json({ message: 'Citizen accounts must verify their email before activation.' });
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await recordAuditEvent({
      req,
      targetUser: targetUser._id,
      action: targetUser.role === 'lgu_personnel' && previousStatus !== status
        ? (status === 'active' ? 'LGU_ACCOUNT_ENABLED' : status === 'suspended' ? 'LGU_ACCOUNT_DISABLED' : 'LGU_ACCOUNT_UPDATED')
        : 'USER_STATUS_CHANGED',
      outcome: 'success',
      details: { previousStatus, newStatus: status }
    });

    res.status(200).json({
      message: `User account (${targetUser.email}) has been successfully set to ${status}.`,
      user: {
        id: targetUser._id,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error while updating user status.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own active admin account.' });
    }

    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Only admins can delete admin accounts.' });
    }

    if (req.user.role === 'lgu_personnel') {
      const managesCitizen = user.role === 'citizen'
        && sameCity(req.user.jurisdiction?.municipalityOrCity, user.address?.municipalityOrCity);
      if (!managesCitizen && !canLGUManagePersonnel(req.user, user)) {
        return res.status(403).json({
          message: 'Access denied: LGU personnel can delete citizens or barangay personnel only within their municipality or city.'
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    await recordAuditEvent({
      req,
      targetUser: user._id,
      action: 'USER_DELETED',
      outcome: 'success',
      details: { deletedRole: user.role }
    });

    res.status(200).json({
      message: `User account (${user.email}) has been successfully deleted.`,
      userId: user._id
    });
  } catch (err) {
    console.error('User deletion error:', err.message);
    res.status(500).json({ message: 'Server error while deleting user.' });
  }
};

async function changePassword(req, res) {
  res.set('Cache-Control', 'no-store');
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const errors = [];
  if (typeof currentPassword !== 'string' || !currentPassword) errors.push({ path: 'currentPassword', msg: 'Enter your current password.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[\W_]/.test(newPassword)) errors.push({ path: 'newPassword', msg: 'Use 8 or more characters, up to 72 bytes, with an uppercase letter, number, and special character.' });
  if (newPassword !== confirmPassword) errors.push({ path: 'confirmPassword', msg: 'Passwords do not match.' });
  if (errors.length) return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Your session has expired.' });
    if (!await bcrypt.compare(currentPassword, user.password)) return res.status(400).json({ message: 'Current password is incorrect.', errors: [{ path: 'currentPassword', msg: 'Current password is incorrect.' }] });
    if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ message: 'Choose a different new password.', errors: [{ path: 'newPassword', msg: 'Choose a different new password.' }] });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    await recordAuditEvent({ req, targetUser: user._id, action: user.role === 'lgu_personnel' ? 'LGU_PASSWORD_CHANGED' : 'AUTH_PASSWORD_CHANGED', outcome: 'success' });
    // Preserve the application's existing JWT expiration policy.
    return res.json({ message: 'Password changed successfully.' });
  } catch { return res.status(500).json({ message: 'Unable to update your password.' }); }
}

module.exports = {
  changePassword,
  registerCitizen,
  verifyEmail,
  resendVerification,
  registerPersonnel,
  applyPersonnel,
  loginUser,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyMfaLogin,
  recoverMfaLogin,
  getCurrentUser,
  getPendingPersonnel,
  approvePersonnel,
  forgotPassword,
  resetPassword,
  updateUserStatus,
  deleteUser
};
