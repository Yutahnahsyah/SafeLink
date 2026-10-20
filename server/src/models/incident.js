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
      'escalation_requested',
      'closure_confirmation_requested',
      'closure_confirmed',
      'priority_confirmed',
      'barangay_handling_confirmed',
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
      landmark: { type: String, default: null },
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
    enum: ['Submitted', 'Under Barangay Review', 'Under Validation', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'],
    default: 'Submitted'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  citizenUrgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true,
    default: 'Medium'
  },
  priorityConfirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  priorityConfirmedAt: {
    type: Date,
    default: null
  },
  // Separate publication decision; workflow verification alone never makes a report public.
  communityMapApprovedAt: { type: Date, default: null },
  communityMapApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  communityMapPublicationStatus: { type: String, enum: ['pending', 'published', 'held', 'hidden'], default: 'pending' },
  communityMapPublicationReason: { type: String, default: null },
  assignedAgency: {
    type: String,
    enum: ['Barangay', 'LGU', 'Police', 'Unassigned'],
    default: 'Barangay'
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
  barangaySupport: {
    type: Boolean,
    default: false
  },
  escalation: {
    agency: {
      type: String,
      enum: ['LGU', 'Police'],
      default: null
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    requestedAt: {
      type: Date,
      default: null
    },
    reason: {
      type: String,
      default: null
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    acknowledgedAt: {
      type: Date,
      default: null
    }
  },
  closureConfirmation: {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    requestedAt: {
      type: Date,
      default: null
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    confirmedAt: {
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
IncidentSchema.index({ createdAt: -1 });
IncidentSchema.index({ 'location.geoPoint': '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Incident', IncidentSchema);
