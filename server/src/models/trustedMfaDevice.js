const mongoose = require('mongoose');

// The browser receives only the random token. MongoDB stores its SHA-256 hash,
// so a database read cannot be used as a trusted-device credential.
const TrustedMfaDeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true, bufferCommands: false });

// Expired tokens are rejected in queries immediately; this index cleans their
// records up asynchronously afterwards.
TrustedMfaDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TrustedMfaDevice', TrustedMfaDeviceSchema);
