const express = require('express');
const router = express.Router();
const {
  createIncident,
  getIncidents,
  getMapIncidents,
  getMapBoundary,
  processIncident
} = require('../controllers/incidentController');
const { addEvidence, downloadEvidence } = require('../controllers/evidenceController');
const { verifyToken } = require('../middleware/auth');
const { uploadEvidence } = require('../middleware/evidenceUpload');
const {
  validateIncidentCreation,
  validateIncidentProcessing
} = require('../middleware/validation');

// Simple inline role gate. Move to middleware/roles.js if you want to reuse it elsewhere.
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
  }
  next();
};

// POST Submit Incident Report (Citizen)
router.post(
  '/',
  verifyToken,
  requireRole('citizen'),
  validateIncidentCreation,
  createIncident
);

// GET View Incidents (Citizen, Barangay, LGU, Police, Admin)
router.get('/', verifyToken, getIncidents);

// GET Privacy-safe markers and boundary for a Leaflet community safety map.
router.get('/map', verifyToken, getMapIncidents);
router.get('/map/boundary', verifyToken, getMapBoundary);

router.post('/:id/evidence', verifyToken, (req, res, next) => {
  uploadEvidence.array('evidence', 5)(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Each evidence file must be 20 MB or smaller.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Attach no more than five evidence files at once.' });
    }
    return res.status(400).json({
      message: 'Only JPEG, PNG, WebP, MP4, WebM, and MOV evidence files are allowed.'
    });
  });
}, addEvidence);
router.get('/:id/evidence/:evidenceId', verifyToken, downloadEvidence);

// PATCH Process & Refer Incident (Barangay, LGU, Police, Admin)
router.patch(
  '/:id/process',
  verifyToken,
  requireRole('barangay_personnel', 'lgu_personnel', 'police_personnel', 'admin'),
  validateIncidentProcessing,
  processIncident
);

module.exports = router;
