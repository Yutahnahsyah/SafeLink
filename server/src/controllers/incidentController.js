const Incident = require('../models/incident');
const User = require('../models/user');
const { recordAuditEvent } = require('../utils/auditLog');

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
const REFERRABLE_STATUSES = new Set(['Verified', 'In Progress', 'Resolved', 'Closed']);
const AGENCY_PERSONNEL_ROLES = {
  Barangay: 'barangay_personnel',
  LGU: 'lgu_personnel',
  Police: 'police_personnel'
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

const hasField = (object, field) => Object.prototype.hasOwnProperty.call(object, field);

const appendResponseHistory = (incident, updatedBy, eventType, notes, changes = {}) => {
  incident.responseHistory.push({
    eventType,
    status: incident.status,
    notes,
    updatedBy,
    ...changes
  });
};

const withRemarks = (message, remarks) => (
  remarks ? `${message} Remarks: ${remarks}` : message
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
        eventType: 'submitted',
        status: 'Submitted',
        newStatus: 'Submitted',
        notes: duplicate
          ? 'Incident report submitted and flagged for duplicate review.'
          : 'Incident report submitted by citizen and pending validation.',
        updatedBy: req.user.id
      }]
    });

    await incident.save();
    await recordAuditEvent({
      req,
      actor: req.user.id,
      incident: incident._id,
      action: 'INCIDENT_SUBMITTED',
      outcome: 'success',
      details: { incidentType: incident.incidentType }
    });
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
    const hasAssignedAgency = hasField(req.body, 'assignedAgency');
    const hasAssignedPersonnel = hasField(req.body, 'assignedPersonnel');
    if (!status && !severity && !hasAssignedAgency && !hasAssignedPersonnel && !remarks) {
      return res.status(400).json({ message: 'Provide a status, severity, assignment, referral, or remark to process the incident.' });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    if (!canAccessIncident(req.user, incident)) {
      return res.status(403).json({ message: 'Access denied: this incident is not assigned to your account or is outside your jurisdiction.' });
    }

    const previousStatus = incident.status;
    const previousSeverity = incident.severity;
    const previousAssignedAgency = incident.assignedAgency;
    const previousAssignedPersonnel = incident.assignedPersonnel;
    const nextStatus = status || previousStatus;
    const nextAssignedAgency = hasAssignedAgency ? assignedAgency : previousAssignedAgency;
    const statusChanged = nextStatus !== previousStatus;
    const severityChanged = Boolean(severity && severity !== previousSeverity);

    if (statusChanged && !STATUS_TRANSITIONS[previousStatus].includes(nextStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${previousStatus} to ${nextStatus}.`
      });
    }

    if ((hasAssignedPersonnel || hasAssignedAgency) && !canManageAssignment(req.user, incident)) {
      return res.status(403).json({
        message: 'Access denied: only an administrator or the responsible LGU can assign, reassign, or refer an incident.'
      });
    }

    if (nextAssignedAgency === 'Unassigned' && hasAssignedPersonnel) {
      return res.status(400).json({ message: 'An unassigned agency cannot have assigned personnel.' });
    }

    let personnelUser = null;
    if (hasAssignedPersonnel) {
      personnelUser = await User.findById(assignedPersonnel);
      if (!personnelUser || personnelUser.role === 'citizen' || !personnelUser.isVerified || personnelUser.status !== 'active') {
        return res.status(400).json({ message: 'Selected personnel must be an active, verified personnel account.' });
      }
      if (!canCoverIncidentLocation({ role: personnelUser.role, jurisdiction: personnelUser.jurisdiction }, incident)) {
        return res.status(400).json({ message: 'Selected personnel does not cover this incident location.' });
      }
    }

    let effectivePersonnel = personnelUser;
    if (!effectivePersonnel && previousAssignedPersonnel && nextAssignedAgency !== 'Unassigned') {
      effectivePersonnel = await User.findById(previousAssignedPersonnel).select('role');
      if (!effectivePersonnel) {
        return res.status(400).json({ message: 'The currently assigned personnel account no longer exists. Reassign the incident before referring it.' });
      }
    }

    if (effectivePersonnel && nextAssignedAgency !== 'Unassigned'
      && AGENCY_PERSONNEL_ROLES[nextAssignedAgency] !== effectivePersonnel.role) {
      return res.status(400).json({
        message: `The assigned personnel role must match the ${nextAssignedAgency} referral agency.`
      });
    }

    const agencyChanged = nextAssignedAgency !== previousAssignedAgency;
    if (agencyChanged && nextAssignedAgency !== 'Unassigned' && !REFERRABLE_STATUSES.has(nextStatus)) {
      return res.status(400).json({
        message: 'An incident must be verified before it can be referred to an agency.'
      });
    }

    const nextAssignedPersonnel = nextAssignedAgency === 'Unassigned'
      ? null
      : (personnelUser?._id || previousAssignedPersonnel || null);
    const personnelChanged = String(nextAssignedPersonnel || '') !== String(previousAssignedPersonnel || '');

    if (!statusChanged && !severityChanged && !agencyChanged && !personnelChanged && !remarks) {
      return res.status(400).json({ message: 'No incident changes were provided.' });
    }

    if (statusChanged) incident.status = nextStatus;
    if (severityChanged) incident.severity = severity;
    if (agencyChanged) {
      incident.assignedAgency = nextAssignedAgency;
      incident.referral = nextAssignedAgency === 'Unassigned'
        ? undefined
        : {
          agency: nextAssignedAgency,
          referredBy: req.user.id,
          referredAt: new Date()
        };
    }
    if (personnelChanged) incident.assignedPersonnel = nextAssignedPersonnel;

    if (statusChanged) {
      appendResponseHistory(
        incident,
        req.user.id,
        'status_changed',
        withRemarks(`Status changed from ${previousStatus} to ${nextStatus}.`, remarks),
        { previousStatus, newStatus: nextStatus }
      );
    }
    if (severityChanged) {
      appendResponseHistory(
        incident,
        req.user.id,
        'severity_changed',
        withRemarks(`Severity changed from ${previousSeverity} to ${severity}.`, remarks),
        { previousSeverity, newSeverity: severity }
      );
    }
    if (agencyChanged) {
      const eventType = nextAssignedAgency === 'Unassigned' ? 'agency_unassigned' : 'agency_referred';
      const message = nextAssignedAgency === 'Unassigned'
        ? `Referral to ${previousAssignedAgency} was removed.`
        : `Incident referred to ${nextAssignedAgency}.`;
      appendResponseHistory(
        incident,
        req.user.id,
        eventType,
        withRemarks(message, remarks),
        {
          previousAssignedAgency,
          newAssignedAgency: nextAssignedAgency,
          previousAssignedPersonnel,
          newAssignedPersonnel: nextAssignedPersonnel
        }
      );
    }
    if (personnelChanged && nextAssignedAgency !== 'Unassigned') {
      const eventType = previousAssignedPersonnel ? 'personnel_reassigned' : 'personnel_assigned';
      const message = previousAssignedPersonnel
        ? 'Incident reassigned to authorized personnel.'
        : 'Incident assigned to authorized personnel.';
      appendResponseHistory(
        incident,
        req.user.id,
        eventType,
        withRemarks(message, remarks),
        { previousAssignedPersonnel, newAssignedPersonnel: nextAssignedPersonnel }
      );
    }
    if (!statusChanged && !severityChanged && !agencyChanged && !personnelChanged && remarks) {
      appendResponseHistory(incident, req.user.id, 'note_added', remarks);
    }

    await incident.save();

    const auditEvents = [];
    if (statusChanged) {
      auditEvents.push({
        action: 'INCIDENT_STATUS_CHANGED',
        details: { previousStatus, newStatus: nextStatus }
      });
    }
    if (severityChanged) {
      auditEvents.push({
        action: 'INCIDENT_SEVERITY_CHANGED',
        details: { previousSeverity, newSeverity: severity }
      });
    }
    if (agencyChanged) {
      auditEvents.push({
        action: nextAssignedAgency === 'Unassigned' ? 'INCIDENT_REFERRAL_REMOVED' : 'INCIDENT_REFERRED',
        details: { previousAssignedAgency, newAssignedAgency: nextAssignedAgency }
      });
    }
    if (personnelChanged) {
      auditEvents.push({
        action: previousAssignedPersonnel ? 'INCIDENT_REASSIGNED' : 'INCIDENT_ASSIGNED',
        targetUser: nextAssignedPersonnel,
        details: {
          previousAssignedPersonnel: previousAssignedPersonnel?.toString() || null,
          newAssignedPersonnel: nextAssignedPersonnel?.toString() || null
        }
      });
    }
    if (auditEvents.length === 0 && remarks) {
      auditEvents.push({ action: 'INCIDENT_NOTE_ADDED', details: {} });
    }
    await Promise.all(auditEvents.map((event) => recordAuditEvent({
      req,
      incident: incident._id,
      action: event.action,
      outcome: 'success',
      targetUser: event.targetUser || null,
      details: event.details
    })));

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
