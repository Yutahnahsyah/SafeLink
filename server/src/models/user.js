const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
    barangay: { type: String, default: null },
    municipalityOrCity: { type: String, default: null },
    zipCode: { type: String, default: null }
  },
  // Specific to personnel for routing and authorization scope
  jurisdiction: {
    barangay: { type: String, default: null },
    municipalityOrCity: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: function defaultStatus() {
      return this.role === 'citizen' ? 'active' : 'pending';
    }
  },
  isVerified: {
    type: Boolean,
    default: false // Can be used to verify official personnel accounts
  },
  // Add these fields inside your existing UserSchema in src/models/user.js
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
  createdAt: {
    type: Date,
    default: Date.now
  },
});

module.exports = mongoose.model('User', UserSchema);