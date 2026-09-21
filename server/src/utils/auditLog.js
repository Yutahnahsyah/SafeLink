const crypto = require('crypto');
const AuditLog = require('../models/auditLog');

const hashIdentifier = (value) => crypto
  .createHash('sha256')
  .update(value.trim().toLowerCase())
  .digest('hex');

const recordAuditEvent = async ({
  req,
  actor = req?.user?.id || null,
  targetUser = null,
  incident = null,
  action,
  outcome,
  details = {}
}) => {
  try {
    await AuditLog.create({
      actor,
      targetUser,
      incident,
      action,
      outcome,
      details,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      userAgent: req?.get?.('user-agent') || null
    });
  } catch (error) {
    // Audit logging must not turn a successful user action into a failed one.
    // The server error is still visible to operators for investigation.
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = { hashIdentifier, recordAuditEvent };
