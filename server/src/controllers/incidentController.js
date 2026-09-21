const Incident = require('../models/incident');
const User = require('../models/user');

const ACTIVE_DUPLICATE_STATUSES = ['Submitted', 'Under Validation', 'Verified', 'In Progress', 'Resolved'];
const STATUS_TRANSITIONS = {
  Submitted: ['Under Validation'],
  'Under Validation': ['Verified', 'Rejected'],
  Verified: ['In Progress'],
  Rejected: [],
  'In Progress': ['Resolved'],
  Resolved: ['Closed', 'In Progress'],
  Closed: []
};

const samePlace = (first, second) => (
  first?.trim().toLowerCase() === second?.trim().toLowerCase()
);

const distanceInMeters = (first, second) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusInMeters = 6371000;
  const latitudeDifference = toRadians(second.latitude - first.latitude);
  const longitudeDifference = toRadians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(toRadians(first.latitude)) * Math.cos(toRadians(second.latitude))
    * Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusInMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const canCoverIncidentLocation = (user, incident) => {
  if (user.role === 'admin') return true;
  if (user.role === 'barangay_personnel') {
    return samePlace(incident.location.address.barangay, user.jurisdiction?.barangay)
      && samePlace(incident.location.address.municipalityOrCity, user.jurisdiction?.municipalityOrCity);
  }
  if (['lgu_personnel', 'police_personnel'].includes(user.role)) {
    return samePlace(incident.location.address.municipalityOrCity, user.jurisdiction?.municipalityOrCity);
  }
  return false;
};

const isAssignedPersonnel = (user, incident) => (
  Boolean(incident.assignedPersonnel)
  && incident.assignedPersonnel.toString() === user.id.toString()
);

const canAccessIncident = (user, incident) => {
  // Administrators can oversee all reports. LGU personnel are supervisors for
  // reports within their city. All other field personnel may work only on a
  // report explicitly assigned to their account.
  if (user.role === 'admin') return true;
  if (user.role === 'lgu_personnel') return canCoverIncidentLocation(user, incident);
  return isAssignedPersonnel(user, incident);
};

const canManageAssignment = (user, incident) => (
  user.role === 'admin'
  || (user.role === 'lgu_personnel' && canCoverIncidentLocation(user, incident))
);

// @desc    Citizen submits a new safety incident report
// @route   POST /api/incidents
const createIncident = async (req, res) => {
  try {
    const { incidentType, description, location, mediaEvidence } = req.body;
    const submittedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const nearbyReports = await Incident.find({
      incidentType,
      'location.address.barangay': location.address.barangay,
      'location.address.municipalityOrCity': location.address.municipalityOrCity,
      status: { $in: ACTIVE_DUPLICATE_STATUSES },
      createdAt: { $gte: submittedAfter }
    }).select('_id location');

    // Keep the citizen's report and evidence, but flag likely duplicates for personnel
    // rather than silently discarding potentially useful corroborating information.
    const duplicate = nearbyReports.find((report) => distanceInMeters(location, report.location) <= 200);
    const incident = new Incident({
      citizen: req.user.id,
      incidentType,
      description,
      location,
      mediaEvidence: mediaEvidence || [],
      possibleDuplicateOf: duplicate?._id || null,
      responseHistory: [{
        status: 'Submitted',
        notes: duplicate
          ? 'Incident report submitted and flagged for duplicate review.'
          : 'Incident report submitted by citizen and pending validation.',
        updatedBy: req.user.id
      }]
    });

    await incident.save();
    return res.status(201).json({
      message: duplicate
        ? 'Incident reported successfully and flagged for duplicate review.'
        : 'Incident reported successfully.',
      incident
    });
  } catch (err) {
    console.error('Create incident error:', err.message);
    return res.status(500).json({ message: 'Server error while submitting incident.' });
  }
};

// @desc    Get all incidents within the requester's authorized scope
// @route   GET /api/incidents
const getIncidents = async (req, res) => {
  try {
    let query;
    if (req.user.role === 'citizen') query = { citizen: req.user.id };
    else if (req.user.role === 'lgu_personnel') {
      query = { 'location.address.municipalityOrCity': req.user.jurisdiction?.municipalityOrCity };
    } else if (req.user.role === 'admin') query = {};
    else if (['barangay_personnel', 'police_personnel'].includes(req.user.role)) {
      query = { assignedPersonnel: req.user.id };
    }
    else return res.status(403).json({ message: 'Access denied: unrecognized role.' });

    const incidents = await Incident.find(query)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction')
      .populate('possibleDuplicateOf', 'incidentType status createdAt')
      .sort({ createdAt: -1 });
    return res.json(incidents);
  } catch (err) {
    console.error('Fetch incidents error:', err.message);
    return res.status(500).json({ message: 'Server error fetching incidents.' });
  }
};

// @desc    Update, verify, assign, or refer an incident within the requester's jurisdiction
// @route   PATCH /api/incidents/:id/process
const processIncident = async (req, res) => {
  try {
    const { status, severity, assignedAgency, assignedPersonnel, remarks } = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    if (!canAccessIncident(req.user, incident)) {
      return res.status(403).json({ message: 'Access denied: incident is outside your jurisdiction.' });
    }

    if (status && status !== incident.status && !STATUS_TRANSITIONS[incident.status].includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${incident.status} to ${status}.`
      });
    }

    if (assignedPersonnel && !canManageAssignment(req.user, incident)) {
      return res.status(403).json({
        message: 'Access denied: only an administrator or the responsible LGU can assign or reassign personnel.'
      });
    }

    if (assignedPersonnel) {
      const personnelUser = await User.findById(assignedPersonnel);
      if (!personnelUser || personnelUser.role === 'citizen' || !personnelUser.isVerified || personnelUser.status !== 'active') {
        return res.status(400).json({ message: 'Selected personnel must be an active, verified personnel account.' });
      }
      if (!canCoverIncidentLocation({ role: personnelUser.role, jurisdiction: personnelUser.jurisdiction }, incident)) {
        return res.status(400).json({ message: 'Selected personnel does not cover this incident location.' });
      }
    }

    if (status) incident.status = status;
    if (severity) incident.severity = severity;
    if (assignedAgency) incident.assignedAgency = assignedAgency;
    if (assignedPersonnel) incident.assignedPersonnel = assignedPersonnel;

    incident.responseHistory.push({
      status: incident.status,
      notes: remarks || `Incident processed or updated by ${req.user.role}.`,
      updatedBy: req.user.id
    });
    await incident.save();

    const updatedIncident = await Incident.findById(incident._id)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction')
      .populate('possibleDuplicateOf', 'incidentType status createdAt');
    return res.json({ message: 'Incident successfully processed and updated.', incident: updatedIncident });
  } catch (err) {
    console.error('Error processing incident:', err.message);
    return res.status(500).json({ message: 'Server error during incident processing.' });
  }
};

module.exports = { createIncident, getIncidents, processIncident };
