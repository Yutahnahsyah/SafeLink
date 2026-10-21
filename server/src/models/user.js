const mongoose = require('mongoose');
const { getPangasinanZipCode } = require('../utils/pangasinanLocations');
const { getBarangay, validStreet } = require('../utils/registrationLocations');

const isCitizen = function isCitizen() {
  return this.role === 'citizen';
};

const isPersonnel = function isPersonnel() {
  return ['barangay_personnel', 'lgu_personnel', 'police_personnel'].includes(this.role);
};

const isBarangayPersonnel = function isBarangayPersonnel() {
  return this.role === 'barangay_personnel';
};

const validMunicipality = (value) => Boolean(getPangasinanZipCode(value));

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
    // A resident address is required only for citizen accounts. Personnel are
    // scoped by jurisdiction instead; administrators require neither value.
    street: {
      type: String,
      default: null,
      trim: true,
      required: isCitizen,
      validate: {
        validator(value) { return !isCitizen.call(this) || validStreet(value); },
        message: 'Citizen street address must contain 2–255 valid characters.'
      }
    },
    landmark: { type: String, default: null, trim: true, maxlength: 255 },
    barangay: {
      type: String,
      default: null,
      trim: true,
      required: isCitizen,
      validate: {
        validator(value) {
          return !isCitizen.call(this) || Boolean(getBarangay(this.address?.municipalityOrCity, value));
        },
        message: 'Citizen barangay must belong to the selected municipality or city.'
      }
    },
    municipalityOrCity: {
      type: String,
      default: null,
      trim: true,
      required: isCitizen,
      validate: {
        validator(value) { return !isCitizen.call(this) || validMunicipality(value); },
        message: 'Citizen municipality or city must be in Pangasinan.'
      }
    },
    zipCode: {
      type: String,
      default: null,
      trim: true,
      required: isCitizen,
      validate: {
        validator(value) {
          return !isCitizen.call(this) || value === getPangasinanZipCode(this.address?.municipalityOrCity);
        },
        message: 'Citizen ZIP code must match the selected municipality or city.'
      }
    }
  },
  jurisdiction: {
    // Personnel require a municipality/city jurisdiction. Only Barangay
    // personnel additionally require the barangay that they cover.
    barangay: {
      type: String,
      default: null,
      trim: true,
      required: isBarangayPersonnel,
      validate: {
        validator(value) {
          return !isBarangayPersonnel.call(this) || Boolean(getBarangay(this.jurisdiction?.municipalityOrCity, value));
        },
        message: 'Barangay jurisdiction must belong to the selected municipality or city.'
      }
    },
    municipalityOrCity: {
      type: String,
      default: null,
      trim: true,
      required: isPersonnel,
      validate: {
        validator(value) { return !isPersonnel.call(this) || validMunicipality(value); },
        message: 'Personnel municipality or city jurisdiction must be in Pangasinan.'
      }
    }
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
  // Unverified Citizen registrations are temporary. The TTL index below is
  // enforced by MongoDB, so expiry still occurs while the web service sleeps.
  unverifiedAccountExpiresAt: { type: Date, default: null, select: false },
  // Archived accounts remain recoverable, but cannot authenticate because an
  // archive always places the account into the suspended state.
  archivedAt: { type: Date, default: null },
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
UserSchema.index({ unverifiedAccountExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', UserSchema);
