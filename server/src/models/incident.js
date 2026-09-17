const mongoose = require('mongoose');

const ResponseHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const IncidentSchema = new mongoose.Schema({
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  incidentType: {
    type: String,
    enum: [
      'Suspicious activities',
      'Missing or vulnerable persons',
      'Harassment or unsafe encounters',
      'Dangerous road incidents',
      'People requiring assistance',
      'Public fire or smoke incidents',
      'People needing assistance during flooding'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    address: {
      street: { type: String, default: null },
      barangay: { type: String, required: true },
      municipalityOrCity: { type: String, required: true },
      zipCode: { type: String, default: null }
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  mediaEvidence: [{
    type: String // URLs or file paths for photos/videos
  }],
  status: {
    type: String,
    enum: ['Submitted', 'Under Validation', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'],
    default: 'Submitted'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  assignedAgency: {
    type: String,
    enum: ['Barangay', 'LGU', 'Police', 'Unassigned'],
    default: 'Unassigned'
  },
  assignedPersonnel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  possibleDuplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null
  },
  responseHistory: [ResponseHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

IncidentSchema.index({ incidentType: 1, 'location.address.barangay': 1, 'location.address.municipalityOrCity': 1, createdAt: -1 });

module.exports = mongoose.model('Incident', IncidentSchema);