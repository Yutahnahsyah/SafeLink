const Notification = require('../models/notification');

const createNotification = async ({ recipient, incident, type, title, message }) => {
  try {
    return await Notification.create({ recipient, incident, type, title, message });
  } catch (error) {
    // A notification failure must not reverse a completed incident operation.
    console.error('Notification write failed:', error.message);
    return null;
  }
};

module.exports = { createNotification };
