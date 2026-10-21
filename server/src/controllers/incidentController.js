const Incident = require('../models/incident');
const User = require('../models/user');
const { recordAuditEvent } = require('../utils/auditLog');
const { getPangasinanBoundaryFeature } = require('../utils/pangasinanBoundary');
const { createNotification } = require('../utils/notifications');
const { canAccessIncident, canCoverIncidentLocation, canManageAssignment } = require('../utils/incidentAccess');
const { getPangasinanZipCode } = require('../utils/pangasinanLocations');
const { getCommunityMap } = require('./communityMapController');
const { decideResolvedPublication, withdrawPublication } = require('../utils/communityPublicationPolicy');
const { citizenIncidentView } = require('../services/citizenIncidentView');
const { publishIncidentUpdate } = require('../services/realtime');

const ACTIVE_DUPLICATE_STATUSES = ['Submitted', 'Under Barangay Review', 'Under Validation', 'Verified', 'In Progress', 'Resolved'];
const STATUS_TRANSITIONS = {
  Submitted: ['Under Barangay Review'],
  'Under Barangay Review': ['Verified', 'Rejected'],
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findActivePersonnel = async (incident, role) => {
  const municipalityOrCity = incident.location.address.municipalityOrCity?.trim();
  const barangay = incident.location.address.barangay?.trim();
  if (!municipalityOrCity || (role === 'barangay_personnel' && !barangay)) return [];

  const query = {
    role,
    isVerified: true,
    status: 'active',
    'jurisdiction.municipalityOrCity': { $regex: new RegExp(`^${escapeRegExp(municipalityOrCity)}$`, 'i') }
  };
  if (role === 'barangay_personnel') {
    query['jurisdiction.barangay'] = { $regex: new RegExp(`^${escapeRegExp(barangay)}$`, 'i') };
  }
  return User.find(query).select('_id');
};

const notifyPersonnel = async ({ incident, role, type, title, message, priority = 'normal', excludeRecipient = null }) => {
  const personnel = await findActivePersonnel(incident, role);
  return Promise.all(personnel
    .filter((person) => person._id.toString() !== String(excludeRecipient || ''))
    .map((person) => createNotification({
      recipient: person._id,
      incident: incident._id,
      type,
      title,
      message,
      priority
    })));
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
    const { incidentType, description, citizenUrgency, location, mediaEvidence } = req.body;
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
      citizenUrgency,
      severity: citizenUrgency,
      location: {
        ...location,
        address: {
          ...location.address,
          zipCode: location.address.zipCode?.trim() || getPangasinanZipCode(location.address.municipalityOrCity)
        },
        geoPoint: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        }
      },
      mediaEvidence: mediaEvidence || [],
      assignedAgency: 'Barangay',
      possibleDuplicateOf: duplicate?._id || null,
      responseHistory: [{
        eventType: 'submitted',
        status: 'Submitted',
        newStatus: 'Submitted',
        notes: duplicate
          ? `Incident report submitted with ${citizenUrgency} suggested urgency and flagged for duplicate review.`
          : `Incident report submitted with ${citizenUrgency} suggested urgency and automatically routed to the local Barangay review queue.`,
        updatedBy: req.user.id
      }]
    });

    await incident.save();
    void publishIncidentUpdate(incident);
    await recordAuditEvent({
      req,
      actor: req.user.id,
      incident: incident._id,
      action: 'INCIDENT_SUBMITTED',
      outcome: 'success',
      details: { incidentType: incident.incidentType }
    });
    await Promise.all([
      createNotification({
        recipient: incident.citizen,
        incident: incident._id,
        type: 'report_submitted',
        title: 'Report received',
        message: 'Your incident report was submitted and routed to the local Barangay for review.'
      }),
      notifyPersonnel({
        incident,
        role: 'barangay_personnel',
        type: citizenUrgency === 'High' ? 'priority_alert' : 'report_routed',
        title: citizenUrgency === 'High' ? 'High-priority report awaiting Barangay review' : 'New report awaiting Barangay review',
        message: `A new incident report in your Barangay is ready to be claimed and reviewed. Citizen-suggested urgency: ${citizenUrgency}.`,
        priority: citizenUrgency === 'High' ? 'high' : 'normal'
      }),
      notifyPersonnel({
        incident,
        role: 'lgu_personnel',
        type: 'lgu_monitoring',
        title: 'New report in your municipality',
        message: 'A new incident report was routed to its local Barangay. You can monitor or intervene when necessary.'
      })
    ]);
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
  if (req.user.role === 'citizen') return getCommunityMap(req, res);
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
    const allowedStatuses = ['Submitted', 'Under Barangay Review', 'Under Validation', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'];
    if (requestedStatuses && (requestedStatuses.length === 0
      || requestedStatuses.some((item) => !allowedStatuses.includes(item)))) {
      return res.status(400).json({ message: 'One or more status filters are invalid.' });
    }

    if (req.user.role === 'barangay_personnel') {
      query['location.address.barangay'] = req.user.jurisdiction?.barangay;
      query['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (req.user.role === 'lgu_personnel') {
      const { findMunicipalityBoundary } = await import('../../../shared/lguJurisdiction.mjs');
      const boundary = findMunicipalityBoundary(req.user.jurisdiction?.municipalityOrCity);
      if (!boundary) return res.status(403).json({ message: 'Your LGU has no valid Pangasinan map jurisdiction. Ask your administrator to correct the assigned municipality or city.' });
      query['location.address.municipalityOrCity'] = boundary.properties.safelinkName;
    } else if (req.user.role === 'police_personnel') {
      query['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Administrators do not have access to incident maps.' });
    } else {
      return res.status(403).json({ message: 'Access denied: unrecognized role.' });
    }

    if (requestedStatuses) {
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

    const reviewRequired = [];
    let mappedIncidents = incidents;
    if (req.user.role === 'lgu_personnel') {
      const { assessMunicipalityCoordinates } = await import('../../../shared/lguJurisdiction.mjs');
      mappedIncidents = incidents.filter(incident => {
        // Keep the existing LGU location-based authorization rule. Never trust
        // a returned record outside the scoped query, even when its pin fits.
        if (!canAccessIncident({ ...req.user, jurisdiction: { ...req.user.jurisdiction,
          municipalityOrCity: query['location.address.municipalityOrCity'] } }, incident)) return false;
        const assessment = assessMunicipalityCoordinates(incident.location?.longitude, incident.location?.latitude,
          query['location.address.municipalityOrCity']);
        if (assessment.status === 'consistent') return true;
        reviewRequired.push({ id: incident._id.toString(), reason: assessment.status,
          municipalityOrCity: incident.location?.address?.municipalityOrCity,
          detectedMunicipalities: assessment.municipalities });
        return false;
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      type: 'FeatureCollection',
      features: mappedIncidents.map((incident) => ({
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
      metadata: { resultLimit: 1000, returned: incidents.length,
        ...(req.user.role === 'lgu_personnel' ? { mapped: mappedIncidents.length, reviewRequired } : {}) }
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Invalid map filter.' });
  }
};

// @desc    Get the assigned municipality boundary for LGUs, or the province for other map roles
// @route   GET /api/incidents/map/boundary
const getMapBoundary = async (req, res) => {
  if (req.user.role !== 'lgu_personnel') return res.json(getPangasinanBoundaryFeature());
  try {
    const { findMunicipalityBoundary } = await import('../../../shared/lguJurisdiction.mjs');
    const boundary = findMunicipalityBoundary(req.user.jurisdiction?.municipalityOrCity);
    if (!boundary) return res.status(403).json({ message: 'Your LGU has no valid Pangasinan map jurisdiction. Ask your administrator to correct the assigned municipality or city.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(boundary);
  } catch {
    return res.status(503).json({ message: 'The jurisdiction boundary could not be loaded. Please retry.' });
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
    } else if (req.user.role === 'barangay_personnel') {
      const scope = {
        'location.address.barangay': req.user.jurisdiction?.barangay,
        'location.address.municipalityOrCity': req.user.jurisdiction?.municipalityOrCity
      };
      query = {
        $or: [
          { ...scope, assignedAgency: 'Barangay', assignedPersonnel: null },
          { ...scope, assignedAgency: 'Barangay', assignedPersonnel: req.user.id },
          { ...scope, barangaySupport: true }
        ]
      };
    } else if (req.user.role === 'police_personnel') {
      query = { assignedPersonnel: req.user.id, 'location.address.municipalityOrCity': req.user.jurisdiction?.municipalityOrCity };
    } else if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Administrators do not have access to incidents.' });
    } else return res.status(403).json({ message: 'Access denied: unrecognized role.' });

    const incidents = await Incident.find(query)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction')
      .populate('possibleDuplicateOf', 'incidentType status createdAt')
      .sort({ createdAt: -1 });
    return res.json(req.user.role === 'citizen' ? incidents.map(citizenIncidentView) : incidents);
  } catch (err) {
    console.error('Fetch incidents error:', err.message);
    return res.status(500).json({ message: 'Server error fetching incidents.' });
  }
};

// @desc    Update, verify, assign, or refer an incident within the requester's jurisdiction
// @route   PATCH /api/incidents/:id/process
const processIncident = async (req, res) => {
  try {
    const { status, severity, assignedAgency, assignedPersonnel, escalationAgency, handlingDecision, remarks, closureConfirmed } = req.body;
    const hasAssignedAgency = hasField(req.body, 'assignedAgency');
    const hasAssignedPersonnel = hasField(req.body, 'assignedPersonnel');
    const hasSeverity = hasField(req.body, 'severity');
    const hasEscalationRequest = hasField(req.body, 'escalationAgency');
    const hasHandlingDecision = hasField(req.body, 'handlingDecision');
    const hasClosureConfirmation = closureConfirmed === true;
    if (!status && !hasSeverity && !hasAssignedAgency && !hasAssignedPersonnel && !hasEscalationRequest && !hasHandlingDecision && !remarks && !hasClosureConfirmation) {
      return res.status(400).json({ message: 'Provide a status, priority, assignment, escalation, referral, or remark to process the incident.' });
    }

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    if (!canAccessIncident(req.user, incident)) {
      return res.status(403).json({ message: 'Access denied: this incident is not assigned to your account or is outside your jurisdiction.' });
    }
    if (hasHandlingDecision && req.user.role !== 'barangay_personnel') {
      return res.status(403).json({ message: 'Only the responsible Barangay responder can choose local handling.' });
    }
    if (hasSeverity && req.user.role !== 'barangay_personnel') {
      return res.status(403).json({ message: 'Only the responsible Barangay can set the official report priority.' });
    }
    if (hasEscalationRequest && req.user.role !== 'barangay_personnel') {
      return res.status(403).json({ message: 'Only the responsible Barangay can request escalation.' });
    }

    const isSupportingBarangay = req.user.role === 'barangay_personnel' && incident.barangaySupport;
    if (isSupportingBarangay && (status || hasSeverity || hasAssignedAgency || hasAssignedPersonnel || hasEscalationRequest || hasHandlingDecision)) {
      return res.status(403).json({
        message: 'Barangay personnel are supporting responders after LGU intervention and may only add updates, evidence, or confirm closure.'
      });
    }
    const isUnclaimedBarangayReport = req.user.role === 'barangay_personnel'
      && incident.assignedAgency === 'Barangay'
      && !incident.assignedPersonnel
      && !incident.barangaySupport;
    if (isUnclaimedBarangayReport && !hasClosureConfirmation
      && (status || hasSeverity || hasEscalationRequest || hasHandlingDecision || remarks) && !hasAssignedPersonnel) {
      return res.status(400).json({
        message: 'Claim this Barangay report by assigning it to your own account before processing it.'
      });
    }
    if (hasClosureConfirmation
      && (req.user.role !== 'barangay_personnel' || !canCoverIncidentLocation(req.user, incident))) {
      return res.status(403).json({ message: 'Only the responsible Barangay can confirm final closure.' });
    }
    if (hasClosureConfirmation && (status || hasSeverity || hasAssignedAgency || hasAssignedPersonnel || hasEscalationRequest || hasHandlingDecision)) {
      return res.status(400).json({ message: 'Submit closure confirmation separately from other incident changes.' });
    }
    if (status === 'Closed') {
      return res.status(400).json({ message: 'A report can only be closed through Barangay closure confirmation.' });
    }

    const previousStatus = incident.status;
    const previousSeverity = incident.severity;
    const previousAssignedAgency = incident.assignedAgency;
    const previousAssignedPersonnel = incident.assignedPersonnel;
    let nextStatus = status || previousStatus;
    const nextAssignedAgency = hasAssignedAgency ? assignedAgency : previousAssignedAgency;
    if (hasHandlingDecision) {
      if (handlingDecision !== 'Barangay' || hasEscalationRequest || hasAssignedAgency || hasAssignedPersonnel) {
        return res.status(400).json({ message: 'Choose local handling separately from assignment or referral requests.' });
      }
      if (previousAssignedAgency !== 'Barangay' || String(previousAssignedPersonnel || '') !== String(req.user.id)) {
        return res.status(403).json({ message: 'Only the responsible local Barangay assignee may choose Barangay handling.' });
      }
      if (!['Under Barangay Review', 'Under Validation', 'Verified'].includes(previousStatus)
        || !['Verified', 'In Progress'].includes(nextStatus)
        || (!incident.priorityConfirmedAt && !hasSeverity)
        || (incident.escalation?.requestedAt && !incident.escalation?.acknowledgedAt)
        || incident.responseHistory.some((entry) => entry.eventType === 'barangay_handling_confirmed')) {
        return res.status(409).json({ message: 'Local handling requires verified review and confirmed priority, no pending referral, and a decision that has not already been recorded.' });
      }
    }
    // Local response uses this endpoint's Barangay permissions, never LGU powers.
    if (req.user.role === 'barangay_personnel' && ['In Progress', 'Resolved'].includes(status)) {
      if (previousAssignedAgency !== 'Barangay' || !previousAssignedPersonnel
        || String(previousAssignedPersonnel) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Only the responsible Barangay responder may update a locally handled incident.' });
      }
      if (!incident.priorityConfirmedAt || !['Verified', 'In Progress'].includes(previousStatus)) {
        return res.status(409).json({ message: 'Complete Barangay review and confirm the official priority before beginning or resolving a local response.' });
      }
      if (incident.escalation?.requestedAt && !incident.escalation?.acknowledgedAt) {
        return res.status(409).json({ message: 'LGU coordination is pending. Add supporting updates while awaiting LGU action.' });
      }
      if (status === 'Resolved' && (typeof remarks !== 'string' || !remarks.trim())) {
        return res.status(400).json({ message: 'Resolution remarks are required to resolve a Barangay-handled incident.' });
      }
    }
    // Municipal visibility is not assignment authority over an unreviewed report.
    // Check the persisted state, not a status supplied alongside the assignment.
    if (req.user.role === 'lgu_personnel' && (hasAssignedAgency || hasAssignedPersonnel || status)
      && (!REFERRABLE_STATUSES.has(previousStatus) || !incident.priorityConfirmedAt)) {
      return res.status(409).json({
        message: 'Barangay must complete review and confirm the official priority before LGU can assign personnel, refer this report, or update its response status.'
      });
    }
    if (req.user.role === 'police_personnel' && status
      && (!REFERRABLE_STATUSES.has(previousStatus) || !incident.priorityConfirmedAt)) {
      return res.status(409).json({
        message: 'Barangay must complete review and confirm the official priority before Police can update the response status.'
      });
    }
    if (req.user.role === 'police_personnel' && status
      && (!['In Progress', 'Resolved'].includes(status) || nextAssignedAgency !== 'Police')) {
      return res.status(403).json({ message: 'Police personnel may only update the response status of reports assigned to Police.' });
    }
    if (req.user.role === 'lgu_personnel' && status) {
      if (!['In Progress', 'Resolved'].includes(status)) {
        return res.status(403).json({
          message: 'LGU personnel may monitor pending reports, but only Barangay can review, verify, or reject them.'
        });
      }
      if (nextAssignedAgency !== 'LGU') {
        return res.status(403).json({
          message: 'LGU personnel must take over a verified report before updating its response status.'
        });
      }
    }
    if (hasClosureConfirmation) {
      if (previousStatus !== 'Resolved') {
        return res.status(400).json({ message: 'Only a resolved report can be confirmed for closure.' });
      }
      if (incident.closureConfirmation?.confirmedAt) {
        return res.status(400).json({ message: 'This report has already received Barangay closure confirmation.' });
      }
      nextStatus = 'Closed';
    }
    const statusChanged = nextStatus !== previousStatus;
    const severityChanged = hasSeverity && severity !== previousSeverity;
    const priorityConfirmed = hasSeverity && req.user.role === 'barangay_personnel';

    if (statusChanged && !STATUS_TRANSITIONS[previousStatus].includes(nextStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${previousStatus} to ${nextStatus}.`
      });
    }
    if (nextStatus === 'Verified' && !incident.priorityConfirmedAt && !priorityConfirmed) {
      return res.status(400).json({
        message: 'Barangay personnel must confirm an official priority before verifying this report.'
      });
    }
    if (hasEscalationRequest) {
      if (!['Verified', 'In Progress'].includes(nextStatus)) {
        return res.status(400).json({ message: 'A report must be verified before Barangay can request escalation.' });
      }
      if (!remarks) {
        return res.status(400).json({ message: 'Provide remarks explaining why escalation is needed.' });
      }
      if (incident.escalation?.requestedAt && !incident.escalation?.acknowledgedAt) {
        return res.status(400).json({ message: 'An escalation request is already awaiting LGU action.' });
      }
    }

    const barangayClaim = req.user.role === 'barangay_personnel'
      && isUnclaimedBarangayReport
      && !hasAssignedAgency
      && hasAssignedPersonnel
      && assignedPersonnel === req.user.id;
    if ((hasAssignedPersonnel || hasAssignedAgency) && !canManageAssignment(req.user, incident) && !barangayClaim) {
      return res.status(403).json({
        message: 'Access denied: only the responsible LGU can assign, reassign, or refer an incident.'
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

    const lguIntervention = req.user.role === 'lgu_personnel'
      && nextAssignedAgency === 'LGU'
      && previousAssignedAgency !== 'LGU';

    let effectivePersonnel = personnelUser;
    if (!effectivePersonnel && lguIntervention) {
      effectivePersonnel = { _id: req.user.id, role: 'lgu_personnel' };
    } else if (!effectivePersonnel && previousAssignedPersonnel && nextAssignedAgency !== 'Unassigned') {
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
    if (agencyChanged && nextAssignedAgency !== 'Unassigned'
      && !REFERRABLE_STATUSES.has(nextStatus)) {
      return res.status(400).json({
        message: 'An incident must be verified before it can be referred to an agency.'
      });
    }

    const nextAssignedPersonnel = nextAssignedAgency === 'Unassigned'
      ? null
      : (personnelUser?._id || (lguIntervention ? req.user.id : previousAssignedPersonnel) || null);
    const personnelChanged = String(nextAssignedPersonnel || '') !== String(previousAssignedPersonnel || '');

    if (!statusChanged && !severityChanged && !priorityConfirmed && !agencyChanged && !personnelChanged && !hasEscalationRequest && !hasHandlingDecision && !remarks && !hasClosureConfirmation) {
      return res.status(400).json({ message: 'No incident changes were provided.' });
    }

    // Reject stale claims and response changes atomically at save time. This uses
    // the existing version key and needs no migration or record rewriting.
    incident.$where = { __v: incident.__v === undefined ? { $exists: false } : incident.__v };
    incident.increment();
    if (statusChanged) incident.status = nextStatus;
    if (severityChanged) incident.severity = severity;
    if (priorityConfirmed) {
      incident.severity = severity;
      incident.priorityConfirmedBy = req.user.id;
      incident.priorityConfirmedAt = new Date();
    }
    if (hasEscalationRequest) {
      incident.escalation = {
        agency: escalationAgency,
        requestedBy: req.user.id,
        requestedAt: new Date(),
        reason: remarks,
        acknowledgedBy: null,
        acknowledgedAt: null
      };
    }
    if (agencyChanged) {
      incident.assignedAgency = nextAssignedAgency;
      incident.referral = nextAssignedAgency === 'Unassigned'
        ? undefined
        : {
          agency: nextAssignedAgency,
          referredBy: req.user.id,
          referredAt: new Date()
        };
      if (previousAssignedAgency === 'Barangay' && ['LGU', 'Police'].includes(nextAssignedAgency)) {
        incident.barangaySupport = true;
      }
    }
    if (personnelChanged) incident.assignedPersonnel = nextAssignedPersonnel;
    const escalationAcknowledged = req.user.role === 'lgu_personnel'
      && agencyChanged
      && incident.escalation?.requestedAt
      && !incident.escalation?.acknowledgedAt;
    if (escalationAcknowledged) {
      incident.escalation.acknowledgedBy = req.user.id;
      incident.escalation.acknowledgedAt = new Date();
    }
    const closureConfirmationRequested = statusChanged && nextStatus === 'Resolved';
    if (closureConfirmationRequested) {
      incident.closureConfirmation = {
        requestedBy: req.user.id,
        requestedAt: new Date(),
        confirmedBy: null,
        confirmedAt: null
      };
    }
    if (hasClosureConfirmation) {
      incident.closureConfirmation = {
        requestedBy: incident.closureConfirmation?.requestedBy || null,
        requestedAt: incident.closureConfirmation?.requestedAt || new Date(),
        confirmedBy: req.user.id,
        confirmedAt: new Date()
      };
    }

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
    if (priorityConfirmed) {
      appendResponseHistory(
        incident,
        req.user.id,
        'priority_confirmed',
        `Barangay confirmed the official report priority as ${severity}.`,
        { previousSeverity, newSeverity: severity }
      );
    }
    if (hasHandlingDecision) {
      appendResponseHistory(incident, req.user.id, 'barangay_handling_confirmed',
        withRemarks('Handle at Barangay Level confirmed by the responsible responder.', remarks));
    }
    if (hasEscalationRequest) {
      appendResponseHistory(
        incident,
        req.user.id,
        'escalation_requested',
        `Barangay requested ${escalationAgency} escalation. Remarks: ${remarks}`
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
    if (closureConfirmationRequested) {
      appendResponseHistory(
        incident,
        req.user.id,
        'closure_confirmation_requested',
        'The incident was resolved and is awaiting Barangay confirmation before final closure.'
      );
    }
    if (hasClosureConfirmation) {
      appendResponseHistory(
        incident,
        req.user.id,
        'closure_confirmed',
        withRemarks('Barangay confirmed the resolution and closed the incident.', remarks)
      );
    }
    if (!statusChanged && !severityChanged && !priorityConfirmed && !agencyChanged && !personnelChanged && !hasEscalationRequest && !hasHandlingDecision && !hasClosureConfirmation && remarks) {
      appendResponseHistory(incident, req.user.id, 'note_added', remarks);
    }

    const publicationDecision = closureConfirmationRequested ? decideResolvedPublication(incident)
      : statusChanged && nextStatus === 'In Progress' ? withdrawPublication(incident) : null;
    await incident.save();

    void publishIncidentUpdate(incident, previousAssignedPersonnel);

    const auditEvents = [];
    if (hasHandlingDecision) auditEvents.push({ action: 'INCIDENT_BARANGAY_HANDLING_CONFIRMED', details: { assignedAgency: 'Barangay' } });
    if (publicationDecision) auditEvents.push({ action: publicationDecision.action,
      details: { publicationReason: publicationDecision.reason, publicationStatus: incident.communityMapPublicationStatus } });
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
    if (priorityConfirmed) {
      auditEvents.push({
        action: 'INCIDENT_PRIORITY_CONFIRMED',
        details: { citizenUrgency: incident.citizenUrgency, officialSeverity: severity }
      });
    }
    if (hasEscalationRequest) {
      auditEvents.push({
        action: 'INCIDENT_ESCALATION_REQUESTED',
        details: { requestedAgency: escalationAgency }
      });
    }
    if (escalationAcknowledged) {
      auditEvents.push({
        action: 'INCIDENT_ESCALATION_ACKNOWLEDGED',
        details: { requestedAgency: incident.escalation?.agency, assignedAgency: nextAssignedAgency }
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
    if (closureConfirmationRequested) {
      auditEvents.push({ action: 'INCIDENT_CLOSURE_CONFIRMATION_REQUESTED', details: {} });
    }
    if (hasClosureConfirmation) {
      auditEvents.push({ action: 'INCIDENT_CLOSURE_CONFIRMED', details: {} });
    }
    if (remarks) {
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
    if (incident.responseHistory.at(-1)?.eventType === 'note_added') notificationEvents.push({
      type: 'response_updated', title: 'New response update', message: 'A citizen-visible response update is available on your report.' });
    if (escalationAcknowledged) notificationEvents.push({ type: 'escalation_acknowledged', title: 'LGU acknowledged your report',
      message: 'The LGU acknowledged the coordination request and updated the responsible agency.' });
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
    if (priorityConfirmed) {
      notificationEvents.push({
        type: 'priority_confirmed',
        title: 'Report priority confirmed',
        message: `Your local Barangay confirmed the official priority as ${severity}.`,
        priority: severity === 'Critical' ? 'critical' : severity === 'High' ? 'high' : 'normal'
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
    if (hasClosureConfirmation) {
      notificationEvents.push({
        type: 'closure_confirmed',
        title: 'Report closed',
        message: 'Your local Barangay confirmed the resolution and closed your report.'
      });
    }
    const personnelNotifications = [];
    if (personnelChanged && nextAssignedPersonnel) personnelNotifications.push(createNotification({
      recipient: nextAssignedPersonnel, incident: incident._id, type: 'personnel_assigned', title: 'Incident assigned to you',
      message: 'A report in your jurisdiction has been assigned to your account. Review the incident for permitted response actions.' }));
    if (hasEscalationRequest) {
      personnelNotifications.push(notifyPersonnel({
        incident,
        role: 'lgu_personnel',
        type: 'barangay_escalation_requested',
        title: `Barangay requested ${escalationAgency} coordination`,
        message: `Barangay requested ${escalationAgency} coordination. Reason: ${remarks}`,
        priority: incident.severity === 'Critical' ? 'critical' : incident.severity === 'High' ? 'high' : 'normal'
      }));
    } else if (statusChanged && nextStatus === 'Verified') {
      personnelNotifications.push(notifyPersonnel({
        incident,
        role: 'lgu_personnel',
        type: 'lgu_monitoring',
        title: 'Barangay verified a local report',
        message: `Barangay completed review and confirmed ${incident.severity} priority. The report remains available for LGU monitoring.`,
        priority: incident.severity === 'Critical' ? 'critical' : incident.severity === 'High' ? 'high' : 'normal'
      }));
    }
    if (priorityConfirmed && ['High', 'Critical'].includes(severity)) {
      personnelNotifications.push(notifyPersonnel({
        incident,
        role: 'barangay_personnel',
        type: 'priority_alert',
        title: `${severity}-priority report confirmed`,
        message: `Barangay confirmed this report as ${severity} priority. Review the assigned response and coordinate if needed.`,
        priority: severity === 'Critical' ? 'critical' : 'high'
      }));
    }
    if (lguIntervention) {
      personnelNotifications.push(notifyPersonnel({
        incident,
        role: 'barangay_personnel',
        type: 'lgu_intervention',
        title: 'LGU intervention on a local report',
        message: 'The LGU has taken over this report. You remain a supporting responder and may add updates or evidence.',
        excludeRecipient: req.user.id
      }));
    }
    if (closureConfirmationRequested) {
      personnelNotifications.push(notifyPersonnel({
        incident,
        role: 'barangay_personnel',
        type: 'closure_confirmation_requested',
        title: 'Barangay closure confirmation required',
        message: 'A resolved report in your Barangay requires confirmation before it can be finally closed.',
        excludeRecipient: req.user.id
      }));
    }
    await Promise.all([
      ...notificationEvents.map((event) => createNotification({
        recipient: incident.citizen,
        incident: incident._id,
        type: event.type,
        title: event.title,
        message: event.message,
        priority: event.priority
      })),
      ...personnelNotifications
    ]);

    const updatedIncident = await Incident.findById(incident._id)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction')
      .populate('possibleDuplicateOf', 'incidentType status createdAt');
    return res.json({ message: 'Incident successfully processed and updated.', incident: updatedIncident });
  } catch (err) {
    if (['VersionError', 'DocumentNotFoundError'].includes(err.name)) {
      return res.status(409).json({ message: 'This incident changed while you were reviewing it. Refresh the incident before trying again.' });
    }
    console.error('Error processing incident:', err.message);
    return res.status(500).json({ message: 'Server error during incident processing.' });
  }
};

module.exports = { createIncident, getIncidents, getMapIncidents, getMapBoundary, processIncident };
