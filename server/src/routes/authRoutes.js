const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const failedLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (() => { const value = Number(process.env.LOGIN_IP_FAILURE_LIMIT); return Number.isInteger(value) && value > 0 ? value : 100; })(),
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(req, res) {
    const seconds = Math.max(1, Math.ceil(((req.rateLimit.resetTime?.getTime() || Date.now() + 900000) - Date.now()) / 1000));
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({ code: 'NETWORK_RATE_LIMITED', retryAfterSeconds: seconds,
      message: 'Too many sign-in requests from this connection. Please try again later.' });
  }
});

const {
  registerCitizen,
  verifyEmail,
  resendVerification,
  registerPersonnel,
  applyPersonnel,
  loginUser,
  getCurrentUser,
  getPendingPersonnel,
  approvePersonnel,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyMfaLogin,
  recoverMfaLogin,
  beginMfaSettingsEnrollment,
  confirmMfaSettingsEnrollment,
  disableMfaSettings,
  forgotPassword,
  resetPassword,
  updateUserStatus,
  deleteUser
} = require('../controllers/authController');

const {
  verifyAdminOrLGU,
  verifyAdmin,
  verifyToken
} = require('../middleware/auth');

const {
  validateCitizenRegistration,
  validateLogin,
  validateMfaCode,
  validateMfaSetup,
  validateMfaSettingsCode,
  validateMfaRecovery,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation');

// POST Citizen Register (Citizen)
router.post('/register-citizen', validateCitizenRegistration, registerCitizen);
// GET Citizen Verify (Citizen)
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', validateForgotPassword, resendVerification);

// Retired provisioning alias; administrators use /api/admin/personnel-accounts.
router.post('/register-personnel', verifyAdmin, registerPersonnel);

// Retired public application endpoint; historical records remain intact.
router.post('/apply-personnel', applyPersonnel);

router.post('/change-password', verifyToken, require('../controllers/authController').changePassword);

// POST User Login (Citizen, Barangay, LGU, Police, Admin)
router.post('/login', failedLoginLimiter, validateLogin, loginUser);
const mfaLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { code: 'MFA_RATE_LIMITED', message: 'Too many MFA attempts. Please try again in a few minutes.' } });
router.post('/mfa/setup', mfaLimiter, validateMfaSetup, beginMfaEnrollment);
router.post('/mfa/confirm-enrollment', mfaLimiter, validateMfaCode, confirmMfaEnrollment);
router.post('/mfa/verify', mfaLimiter, validateMfaCode, verifyMfaLogin);
router.post('/mfa/recover', mfaLimiter, validateMfaRecovery, recoverMfaLogin);
router.post('/mfa/settings/setup', verifyToken, mfaLimiter, beginMfaSettingsEnrollment);
router.post('/mfa/settings/confirm', verifyToken, mfaLimiter, validateMfaSettingsCode, confirmMfaSettingsEnrollment);
router.post('/mfa/settings/disable', verifyToken, mfaLimiter, validateMfaSettingsCode, disableMfaSettings);
router.get('/me', verifyToken, getCurrentUser);
// Records an authenticated sign-out request; JWTs retain their existing expiry semantics.
router.post('/logout', verifyToken, async (req, res) => {
  await require('../utils/auditLog').recordAuditEvent({ req, action: 'AUTH_LOGOUT', outcome: 'success' });
  res.status(204).end();
});

// Historical personnel applications remain available to administrators.
router.get('/pending-personnel', verifyAdmin, getPendingPersonnel);
// Historical approval is administrator-only.
router.put('/approve-personnel/:id', verifyAdmin, approvePersonnel);
// PATCH User Suspension (LGU, Admin)
router.patch('/users/:id/status', verifyToken, updateUserStatus);

// POST Password Reset Email (Citizen, Barangay, LGU, Police, Admin)
router.post('/forgot-password', validateForgotPassword, forgotPassword);
// POST Password Reset (Citizen, Barangay, LGU, Police, Admin)
router.post('/reset-password/:token', validateResetPassword, resetPassword);

// DELETE User Deletion (LGU, Admin)
router.delete('/users/:id', verifyAdminOrLGU, deleteUser);

module.exports = router;
