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
  validateLogin
} = require('../middleware/validation');

router.post('/register-citizen', validateCitizenRegistration, registerCitizen);
router.get('/verify-email/:token', verifyEmail);
router.post('/register-personnel', validatePersonnelRegistration, registerPersonnel);
router.post('/login', validateLogin, loginUser);

// Admin-only approval routes
router.get('/pending-personnel', verifyAdminOrLGU, getPendingPersonnel);
router.put('/approve-personnel/:id', verifyAdminOrLGU, approvePersonnel);
router.patch('/users/:id/status', verifyToken, updateUserStatus);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.delete('/users/:id', verifyAdminOrLGU, deleteUser);

module.exports = router;