const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const failedLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many unsuccessful login attempts. Please try again in 15 minutes.' }
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
  forgotPassword,
  resetPassword,
  updateUserStatus,
  deleteUser
} = require('../controllers/authController');

const {
  verifyAdminOrLGU,
  verifyToken
} = require('../middleware/auth');

const {
  validateCitizenRegistration,
  validatePersonnelRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation');

// POST Citizen Register (Citizen)
router.post('/register-citizen', validateCitizenRegistration, registerCitizen);
// GET Citizen Verify (Citizen)
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', validateForgotPassword, resendVerification);

// POST Personnel Register (LGU, Admin)
router.post('/register-personnel', verifyAdminOrLGU, validatePersonnelRegistration, registerPersonnel);

// POST Personnel Application (Public; always pending administrator approval)
router.post('/apply-personnel', validatePersonnelRegistration, applyPersonnel);

// POST User Login (Citizen, Barangay, LGU, Police, Admin)
router.post('/login', failedLoginLimiter, validateLogin, loginUser);
router.get('/me', verifyToken, getCurrentUser);

// GET Personnel Pending Accounts (LGU, Admin)
router.get('/pending-personnel', verifyAdminOrLGU, getPendingPersonnel);
// PUT Personnel Approve Account (LGU, Admin)
router.put('/approve-personnel/:id', verifyAdminOrLGU, approvePersonnel);
// PATCH User Suspension (LGU, Admin)
router.patch('/users/:id/status', verifyToken, updateUserStatus);

// POST Password Reset Email (Citizen, Barangay, LGU, Police, Admin)
router.post('/forgot-password', validateForgotPassword, forgotPassword);
// POST Password Reset (Citizen, Barangay, LGU, Police, Admin)
router.post('/reset-password/:token', validateResetPassword, resetPassword);

// DELETE User Deletion (LGU, Admin)
router.delete('/users/:id', verifyAdminOrLGU, deleteUser);

module.exports = router;
