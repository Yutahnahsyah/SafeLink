const Incident = require('../models/incident');
const User = require('../models/user');
const { recordAuditEvent } = require('../utils/auditLog');
const { getPangasinanBoundaryFeature } = require('../utils/pangasinanBoundary');
const { createNotification } = require('../utils/notifications');
const { canAccessIncident, canCoverIncidentLocation, canManageAssignment } = require('../utils/incidentAccess');

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

const REFERRABLE_STATUSES = new Set(['Verified', 'In Progress', 'Resolved', 'Closed']);
const AGENCY_PERSONNEL_ROLES = {
  Barangay: 'barangay_personnel',
  LGU: 'lgu_personnel',
  Police: 'police_personnel'
};

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

const PUBLIC_MAP_STATUSES = ['Verified', 'In Progress', 'Resolved', 'Closed'];

const parseMapNumber = (value, fieldName) => {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${fieldName} must be a number.`);
  return number;
};

const parseMapDate = (value, fieldName) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid ISO date.`);
  return date;
};

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

    const duplicate = nearbyReports.find((report) => distanceInMeters(location, report.location) <= 200);
    const incident = new Incident({
      citizen: req.user.id,
      incidentType,
      description,
      location: {
        ...location,
        geoPoint: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        }
      },
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
    await createNotification({
      recipient: incident.citizen,
      incident: incident._id,
      type: 'report_submitted',
      title: 'Report received',
      message: 'Your incident report was submitted and is pending validation.'
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

// @desc    Get privacy-safe incident markers for the community safety map
// @route   GET /api/incidents/map
const getMapIncidents = async (req, res) => {
  try {
    const { status, severity, incidentType, minLatitude, maxLatitude, minLongitude, maxLongitude } = req.query;
    const query = {};
    const lowerLatitude = parseMapNumber(minLatitude, 'minLatitude');
    const upperLatitude = parseMapNumber(maxLatitude, 'maxLatitude');
    const lowerLongitude = parseMapNumber(minLongitude, 'minLongitude');
    const upperLongitude = parseMapNumber(maxLongitude, 'maxLongitude');
    const from = parseMapDate(req.query.from, 'from');
    const to = parseMapDate(req.query.to, 'to');

    if ((lowerLatitude !== undefined && upperLatitude === undefined)
      || (lowerLongitude !== undefined && upperLongitude === undefined)) {
      return res.status(400).json({ message: 'Map bounds require both minimum and maximum values.' });
    }
    if ((lowerLatitude !== undefined && lowerLatitude > upperLatitude)
      || (lowerLongitude !== undefined && lowerLongitude > upperLongitude)) {
      return res.status(400).json({ message: 'Minimum map bounds cannot exceed maximum bounds.' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ message: 'The from date cannot be after the to date.' });
    }

    const requestedStatuses = status
      ? status.split(',').map((item) => item.trim()).filter(Boolean)
      : null;
    const allowedStatuses = ['Submitted', 'Under Validation', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'];
    if (requestedStatuses && (requestedStatuses.length === 0
      || requestedStatuses.some((item) => !allowedStatuses.includes(item)))) {
      return res.status(400).json({ message: 'One or more status filters are invalid.' });
    }

    if (req.user.role === 'citizen') {
      const visibleStatuses = requestedStatuses
        ? requestedStatuses.filter((item) => PUBLIC_MAP_STATUSES.includes(item))
        : PUBLIC_MAP_STATUSES;
      query.status = { $in: visibleStatuses };
    } else if (req.user.role === 'barangay_personnel') {
      query['location.address.barangay'] = req.user.jurisdiction?.barangay;
      query['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (['lgu_personnel', 'police_personnel'].includes(req.user.role)) {
      query['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: unrecognized role.' });
    }

    if (requestedStatuses && req.user.role !== 'citizen') {
      query.status = { $in: requestedStatuses };
    }
    if (severity) {
      const severities = severity.split(',').map((item) => item.trim()).filter(Boolean);
      const allowedSeverities = ['Low', 'Medium', 'High', 'Critical'];
      if (severities.length === 0 || severities.some((item) => !allowedSeverities.includes(item))) {
        return res.status(400).json({ message: 'One or more severity filters are invalid.' });
      }
      query.severity = { $in: severities };
    }
    if (incidentType) query.incidentType = incidentType;
    if (lowerLatitude !== undefined) {
      query['location.latitude'] = { $gte: lowerLatitude, $lte: upperLatitude };
      query['location.longitude'] = { $gte: lowerLongitude, $lte: upperLongitude };
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) query.createdAt.$lte = to;
    }

    const incidents = await Incident.find(query)
      .select('_id incidentType severity status assignedAgency location.address.barangay location.address.municipalityOrCity location.latitude location.longitude createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(1000);

    return res.json({
      type: 'FeatureCollection',
      features: incidents.map((incident) => ({
        type: 'Feature',
        id: incident._id.toString(),
        geometry: {
          type: 'Point',
          coordinates: [incident.location.longitude, incident.location.latitude]
        },
        properties: {
          incidentType: incident.incidentType,
          severity: incident.severity,
          status: incident.status,
          assignedAgency: incident.assignedAgency,
          barangay: incident.location.address.barangay,
          municipalityOrCity: incident.location.address.municipalityOrCity,
          createdAt: incident.createdAt,
          updatedAt: incident.updatedAt
        }
      })),
      metadata: { resultLimit: 1000, returned: incidents.length }
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Invalid map filter.' });
  }
};

// @desc    Get the Pangasinan boundary for Leaflet rendering
// @route   GET /api/incidents/map/boundary
const getMapBoundary = (req, res) => res.json(getPangasinanBoundaryFeature());

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
    const notificationEvents = [];
    if (statusChanged) {
      notificationEvents.push({
        type: 'status_changed',
        title: 'Report status updated',
        message: `Your report status changed from ${previousStatus} to ${nextStatus}.`
      });
    }
    if (severityChanged) {
      notificationEvents.push({
        type: 'severity_changed',
        title: 'Report severity updated',
        message: `Your report severity is now ${severity}.`
      });
    }
    if (personnelChanged) {
      notificationEvents.push({
        type: 'personnel_assigned',
        title: 'Personnel assigned',
        message: nextAssignedPersonnel
          ? 'Authorized personnel have been assigned to your report.'
          : 'The personnel assignment for your report was removed.'
      });
    }
    if (agencyChanged && nextAssignedAgency !== 'Unassigned') {
      notificationEvents.push({
        type: 'agency_referred',
        title: 'Report referred',
        message: `Your verified report was referred to ${nextAssignedAgency}.`
      });
    }
    await Promise.all(notificationEvents.map((event) => createNotification({
      recipient: incident.citizen,
      incident: incident._id,
      type: event.type,
      title: event.title,
      message: event.message
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

module.exports = { createIncident, getIncidents, getMapIncidents, getMapBoundary, processIncident };
