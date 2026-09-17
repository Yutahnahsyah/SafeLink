const express = require('express');
const router = express.Router();

const {
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

// POST Personnel Register (LGU, Admin)
router.post('/register-personnel', verifyAdminOrLGU, validatePersonnelRegistration, registerPersonnel);

// POST User Login (Citizen, Barangay, LGU, Police, Admin)
router.post('/login', validateLogin, loginUser);

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