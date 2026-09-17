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

router.post('/register-citizen', validateCitizenRegistration, registerCitizen);
router.get('/verify-email/:token', verifyEmail);

// Restricted per @desc: only Admin/LGU can create personnel accounts
router.post('/register-personnel', verifyAdminOrLGU, validatePersonnelRegistration, registerPersonnel);

router.post('/login', validateLogin, loginUser);

router.get('/pending-personnel', verifyAdminOrLGU, getPendingPersonnel);
router.put('/approve-personnel/:id', verifyAdminOrLGU, approvePersonnel);
router.patch('/users/:id/status', verifyToken, updateUserStatus);

router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', validateResetPassword, resetPassword);

router.delete('/users/:id', verifyAdminOrLGU, deleteUser);

module.exports = router;