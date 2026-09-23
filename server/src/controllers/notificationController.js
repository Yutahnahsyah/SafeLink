const Notification = require('../models/notification');

const getNotifications = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const query = { recipient: req.user.id };
    if (req.query.read !== undefined) {
      if (!['true', 'false'].includes(req.query.read)) {
        return res.status(400).json({ message: 'The read filter must be true or false.' });
      }
      query.read = req.query.read === 'true';
    }

    const [notifications, total, unread] = await Promise.all([
      Notification.find(query).populate('incident', 'incidentType status severity').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user.id, read: false })
    ]);
    return res.json({
      data: notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unread
    });
  } catch (error) {
    console.error('Notification fetch error:', error.message);
    return res.status(500).json({ message: 'Server error fetching notifications.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user.id });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }
    return res.json(notification);
  } catch (error) {
    return res.status(400).json({ message: 'Invalid notification ID.' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.json({ message: 'Notifications marked as read.', modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Notification update error:', error.message);
    return res.status(500).json({ message: 'Server error updating notifications.' });
  }
};

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead };
