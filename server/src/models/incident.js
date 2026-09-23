const mongoose = require('mongoose');

const EvidenceFileSchema = new mongoose.Schema({
  storageName: { type: String, required: true, select: false },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const ResponseHistorySchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: [
      'submitted',
      'status_changed',
      'severity_changed',
      'personnel_assigned',
      'personnel_reassigned',
      'agency_referred',
      'agency_unassigned',
      'note_added'
    ],
    default: 'note_added'
  },
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
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null },
  previousSeverity: { type: String, default: null },
  newSeverity: { type: String, default: null },
  previousAssignedAgency: { type: String, default: null },
  newAssignedAgency: { type: String, default: null },
  previousAssignedPersonnel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  newAssignedPersonnel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
    longitude: { type: Number, required: true },
    geoPoint: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    }
  },
  mediaEvidence: [{
    type: String
  }],
  evidenceFiles: {
    type: [EvidenceFileSchema],
    default: []
  },
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
  referral: {
    agency: {
      type: String,
      enum: ['Barangay', 'LGU', 'Police'],
      default: null
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    referredAt: {
      type: Date,
      default: null
    }
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
IncidentSchema.index({ 'location.geoPoint': '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Incident', IncidentSchema);
