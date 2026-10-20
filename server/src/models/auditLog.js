const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actorName: { type: String, maxlength: 160, default: null },
  actorRole: { type: String, default: null },
  requestId: { type: String, default: null },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  outcome: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, { versionKey: false });

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ targetUser: 1, createdAt: -1 });
AuditLogSchema.index({ incident: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ outcome: 1, createdAt: -1, _id: -1 });
AuditLogSchema.index({ actorRole: 1, createdAt: -1, _id: -1 });
AuditLogSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
