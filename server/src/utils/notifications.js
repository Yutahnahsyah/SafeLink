const Notification = require('../models/notification');
const { publishNotification } = require('../services/realtime');

const createNotification = async ({ recipient, incident, type, title, message, priority = 'normal' }) => {
  try {
    const notification = await Notification.create({ recipient, incident, type, title, message, priority });
    if (notification?._id) publishNotification(recipient, 'notification:created', notification._id);
    return notification;
  } catch (error) {
    console.error('Notification write failed:', error.message);
    return null;
  }
};

module.exports = { createNotification };
