const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getNotifications, markNotificationRead, markAllNotificationsRead } = require('../controllers/notificationController');

const router = express.Router();

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
  }
  next();
};

// GET View Notifications (Citizen, Barangay, LGU, Police)
router.get('/', verifyToken, requireRole('citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel'), getNotifications);
// PATCH Mark All Notifications Read (Citizen, Barangay, LGU, Police)
router.patch('/read-all', verifyToken, requireRole('citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel'), markAllNotificationsRead);
// PATCH Mark Notification Read (Citizen, Barangay, LGU, Police)
router.patch('/:id/read', verifyToken, requireRole('citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel'), markNotificationRead);

module.exports = router;
