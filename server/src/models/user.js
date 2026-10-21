const mongoose = require('mongoose');

// Optional on legacy accounts; registration alone supplies server-generated records.
const LegalAcceptanceSchema = new mongoose.Schema({
  termsVersion: { type: String, required: true, immutable: true },
  privacyVersion: { type: String, required: true, immutable: true },
  acceptedAt: { type: Date, required: true, immutable: true }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  legalAcceptance: { type: LegalAcceptanceSchema, default: undefined, immutable: true, select: false },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  middleInitial: {
    type: String,
    trim: true,
    maxlength: 1
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel', 'admin'],
    default: 'citizen'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  address: {
    street: { type: String, default: null },
    landmark: { type: String, default: null },
    barangay: { type: String, default: null },
    municipalityOrCity: { type: String, default: null },
    zipCode: { type: String, default: null }
  },
  jurisdiction: {
    barangay: { type: String, default: null },
    municipalityOrCity: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: function defaultStatus() {
      return this.role === 'admin' || (this.role === 'citizen' && this.isVerified) ? 'active' : 'pending';
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  lastUsedEmailVerificationToken: {
    type: String,
    default: null,
    select: false
  },
  lastUsedEmailVerificationExpires: {
    type: Date,
    default: null,
    select: false
  },
  // TOTP values are encrypted before storage. They are excluded from normal
  // queries so account listings and API responses never expose MFA material.
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, default: null, select: false },
  mfaPendingSecret: { type: String, default: null, select: false },
  mfaPendingExpires: { type: Date, default: null, select: false },
  mfaRecoveryCodeHashes: { type: [String], default: undefined, select: false },
  mfaEnabledAt: { type: Date, default: null },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null }
});
UserSchema.pre('save', function () { this.updatedAt = new Date(); });

UserSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('User', UserSchema);
