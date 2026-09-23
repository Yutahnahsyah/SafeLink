const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { hashIdentifier, recordAuditEvent } = require('../utils/auditLog');

const appUrl = process.env.APP_URL || 'http://localhost:5000';

const sameCity = (first, second) => (
  Boolean(first && second) && first.trim().toLowerCase() === second.trim().toLowerCase()
);

const canLGUManagePersonnel = (requester, personnel) => (
  personnel.role === 'barangay_personnel'
  && sameCity(requester.jurisdiction?.municipalityOrCity, personnel.jurisdiction?.municipalityOrCity)
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    user = new User({
      firstName,
      lastName,
      middleInitial: middleInitial || '',
      email,
      password: hashedPassword,
      phoneNumber,
      address,
      role: 'citizen',
      isVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000
    });

    await user.save();

    const verifyUrl = `${appUrl}/api/auth/verify-email/${verificationToken}`;

    const mailOptions = {
      from: `"SafeLink System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your SafeLink Citizen Account',
      html: `
        <h3>Welcome to SafeLink, ${firstName}!</h3>
        <p>Please click the link below to verify your email address. This link is valid for 24 hours:</p>
        <a href="${verifyUrl}" target="_blank">${verifyUrl}</a>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    await recordAuditEvent({
      req,
      targetUser: user._id,
      action: 'AUTH_CITIZEN_REGISTERED',
      outcome: 'success'
    });

    res.status(201).json({
      message: 'Citizen account created successfully. Please check your email to verify your account before logging in.'
    });
  } catch (err) {
    console.error('Citizen registration error:', err.message);
    res.status(500).json({ message: 'Server error during citizen registration.' });
  }
};

// @desc    Verify a citizen's email address via emailed token
// @route   GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired email verification token.' });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    await recordAuditEvent({
      req,
      actor: user._id,
      targetUser: user._id,
      action: 'AUTH_EMAIL_VERIFIED',
      outcome: 'success'
    });

    res.status(200).json({ message: 'Email verified successfully! You can now log in to your account.' });
  } catch (err) {
    console.error('Email verification error:', err.message);
    res.status(500).json({ message: 'Server error during email verification.' });
  }
};

// @desc    Register Personnel (Barangay, LGU, Police, Admin) - Restricted to Admins/LGU
// @route   POST /api/auth/register-personnel
const registerPersonnel = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, password, role, jurisdiction, phoneNumber } = req.body;
    const email = req.body.email.toLowerCase().trim();

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Account already exists with this email.' });
    }

    if (req.user.role === 'lgu_personnel' && !canLGUManagePersonnel(req.user, { role, jurisdiction })) {
      return res.status(403).json({
        message: 'LGU personnel can register barangay personnel only within their municipality or city.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      firstName,
      lastName,
      middleInitial: middleInitial || '',
      email,
      password: hashedPassword,
      role,
      jurisdiction,
      phoneNumber,
      isVerified: false, // Requires admin approval
      status: 'pending'
    });

    await user.save();

    await recordAuditEvent({
      req,
      targetUser: user._id,
      action: 'PERSONNEL_REGISTRATION_SUBMITTED',
      outcome: 'success',
      details: { role: user.role }
    });

    res.status(201).json({
      message: 'Personnel registration submitted successfully. Awaiting administrator approval.',
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during personnel registration.' });
  }
};

// @desc    Authenticate and Login User/Personnel
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      await recordAuditEvent({
        req,
        action: 'AUTH_LOGIN',
        outcome: 'failure',
        details: {
          reason: 'invalid_credentials',
          attemptedEmailHash: hashIdentifier(email)
        }
      });
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

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

    if (user.status === 'suspended') {
      await recordAuditEvent({
        req,
        targetUser: user._id,
        action: 'AUTH_LOGIN',
        outcome: 'failure',
        details: { reason: 'account_suspended' }
      });
      return res.status(403).json({ message: 'Access denied. Your account has been suspended due to a violation.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordAuditEvent({
        req,
        targetUser: user._id,
        action: 'AUTH_LOGIN',
        outcome: 'failure',
        details: { reason: 'invalid_credentials' }
      });
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    await recordAuditEvent({
      req,
      actor: user._id,
      targetUser: user._id,
      action: 'AUTH_LOGIN',
      outcome: 'success'
    });

    res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during login.' });
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

    const pendingUsers = await User.find(query).select('-password');

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

    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetUrl = `${appUrl}/api/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"SafeLink System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'SafeLink Password Reset Request',
      html: `
        <h3>Password Reset Request</h3>
        <p>You requested a password reset for your SafeLink account.</p>
        <p>Please click the link below to reset your password. This link is valid for 15 minutes:</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset instructions sent to your email.' });
  } catch (err) {
    console.error('Email send error:', err.message);
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
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      outcome: 'success'
    });

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error('Password reset error:', err.message);
    res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// @desc    Update user account status with hierarchical permission checks
// @route   PATCH /api/auth/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body; // Expects 'active', 'suspended', or 'pending'
    const requester = req.user;   // Extracted from JWT middleware

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

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await recordAuditEvent({
      req,
      targetUser: targetUser._id,
      action: 'USER_STATUS_CHANGED',
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

module.exports = {
  registerCitizen,
  verifyEmail,
  registerPersonnel,
  loginUser,
  getPendingPersonnel,
  approvePersonnel,
  forgotPassword,
  resetPassword,
  updateUserStatus,
  deleteUser
};
