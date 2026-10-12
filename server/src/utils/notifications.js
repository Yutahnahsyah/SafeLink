const Notification = require('../models/notification');

const createNotification = async ({ recipient, incident, type, title, message, priority = 'normal' }) => {
  try {
    return await Notification.create({ recipient, incident, type, title, message, priority });
  } catch (error) {
    console.error('Notification write failed:', error.message);
    return null;
  }
};

module.exports = { createNotification };
