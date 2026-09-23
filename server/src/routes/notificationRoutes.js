const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getNotifications, markNotificationRead, markAllNotificationsRead } = require('../controllers/notificationController');

const router = express.Router();

// GET View Notifications (Citizen, Barangay, LGU, Police, Admin)
router.get('/', verifyToken, getNotifications);
// PATCH Mark All Notifications Read (Citizen, Barangay, LGU, Police, Admin)
router.patch('/read-all', verifyToken, markAllNotificationsRead);
// PATCH Mark Notification Read (Citizen, Barangay, LGU, Police, Admin)
router.patch('/:id/read', verifyToken, markNotificationRead);

module.exports = router;
