const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true
  },
  type: {
    type: String,
    enum: [
      'report_submitted',
      'status_changed',
      'severity_changed',
      'personnel_assigned',
      'agency_referred',
      'evidence_added'
    ],
    required: true
  },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
