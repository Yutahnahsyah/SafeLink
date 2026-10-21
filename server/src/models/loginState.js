const mongoose = require('mongoose');

// Separate security state: existing users/passwords and public account projections stay unchanged.
// No TTL index: expiry must not erase escalation before successful authentication.
const LoginStateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  failedAttempts: { type: Number, default: 0, min: 0, max: 4 },
  lockoutStage: { type: Number, default: 0, min: 0, max: 3 },
  lockedUntil: { type: Date, default: null },
  lastFailureAt: { type: Date, default: null },
  leaseToken: { type: String, default: null },
  leaseUntil: { type: Date, default: () => new Date(0) },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
}, { versionKey: false, bufferCommands: false });

module.exports = mongoose.model('LoginState', LoginStateSchema);
