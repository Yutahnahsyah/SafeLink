const express = require('express');
const router = express.Router();
const {
  createIncident,
  getIncidents,
  processIncident
} = require('../controllers/incidentController');
const { verifyToken } = require('../middleware/auth');
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

// PATCH Process & Refer Incident (Barangay, LGU, Police, Admin)
router.patch(
  '/:id/process',
  verifyToken,
  requireRole('barangay_personnel', 'lgu_personnel', 'police_personnel', 'admin'),
  validateIncidentProcessing,
  processIncident
);

module.exports = router;