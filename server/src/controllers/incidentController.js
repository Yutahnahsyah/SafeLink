const Incident = require('../models/incident');
const User = require('../models/user');

// @desc    Citizen submits a new safety incident report
// @route   POST /api/incidents
const createIncident = async (req, res) => {
  try {
    const { incidentType, description, location, mediaEvidence } = req.body;

    // Validate structured address and core fields
    if (
      !incidentType ||
      !description ||
      !location ||
      !location.address ||
      !location.address.barangay ||
      !location.address.municipalityOrCity ||
      location.latitude === undefined ||
      location.longitude === undefined
    ) {
      return res.status(400).json({
        message: 'Missing required report info (Type, Description, Barangay, City, or GPS Coordinates).'
      });
    }

    const incident = new Incident({
      citizen: req.user.id,
      incidentType,
      description,
      location,
      mediaEvidence: mediaEvidence || [],
      responseHistory: [{
        status: 'Submitted',
        notes: 'Incident report submitted by citizen and pending validation.',
        updatedBy: req.user.id,
        timestamp: new Date()
      }]
    });

    await incident.save();
    res.status(201).json({ message: 'Incident reported successfully.', incident });
  } catch (err) {
    console.error('Create incident error:', err.message);
    res.status(500).json({ message: 'Server error while submitting incident.' });
  }
};

// @desc    Get all incidents with automated jurisdiction filtering
// @route   GET /api/incidents
const getIncidents = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'citizen') {
      query.citizen = req.user.id;
    } else if (req.user.role === 'barangay_personnel') {
      query['location.address.barangay'] = req.user.jurisdiction.barangay;
      query['location.address.municipalityOrCity'] = req.user.jurisdiction.municipalityOrCity;
    } else if (['lgu_personnel', 'police_personnel'].includes(req.user.role)) {
      query['location.address.municipalityOrCity'] = req.user.jurisdiction.municipalityOrCity;
    } else if (req.user.role === 'admin') {
      // Admins get the unrestricted query ({}), viewing all incidents system-wide.
    } else {
      // Unknown/unsupported role: fail closed rather than leaking all incidents.
      return res.status(403).json({ message: 'Access denied: unrecognized role.' });
    }

    const incidents = await Incident.find(query)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction')
      .sort({ createdAt: -1 });

    res.json(incidents);
  } catch (err) {
    console.error('Fetch incidents error:', err.message);
    res.status(500).json({ message: 'Server error fetching incidents.' });
  }
};

// @desc    Update/Process/Assign an incident with jurisdiction security check
// @route   PATCH /api/incidents/:id/process
const processIncident = async (req, res) => {
  try {
    const { status, severity, assignedAgency, assignedPersonnel, remarks } = req.body;

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found.' });
    }

    // Security Check: Prevent personnel from processing incidents outside their jurisdiction
    if (req.user.role === 'barangay_personnel') {
      if (
        incident.location.address.barangay !== req.user.jurisdiction.barangay ||
        incident.location.address.municipalityOrCity !== req.user.jurisdiction.municipalityOrCity
      ) {
        return res.status(403).json({ message: 'Access denied: Incident is outside your barangay jurisdiction.' });
      }
    } else if (['lgu_personnel', 'police_personnel'].includes(req.user.role)) {
      if (incident.location.address.municipalityOrCity !== req.user.jurisdiction.municipalityOrCity) {
        return res.status(403).json({ message: 'Access denied: Incident is outside your city/municipality jurisdiction.' });
      }
    }

    // Verify assigned personnel if provided, and that they actually cover this incident's area
    if (assignedPersonnel) {
      const personnelUser = await User.findById(assignedPersonnel);
      if (!personnelUser || personnelUser.role === 'citizen') {
        return res.status(400).json({ message: 'Invalid personnel selected for assignment.' });
      }

      if (personnelUser.role === 'barangay_personnel') {
        if (
          personnelUser.jurisdiction.barangay !== incident.location.address.barangay ||
          personnelUser.jurisdiction.municipalityOrCity !== incident.location.address.municipalityOrCity
        ) {
          return res.status(400).json({ message: "Selected personnel does not cover this incident's barangay." });
        }
      } else if (['lgu_personnel', 'police_personnel'].includes(personnelUser.role)) {
        if (personnelUser.jurisdiction.municipalityOrCity !== incident.location.address.municipalityOrCity) {
          return res.status(400).json({ message: "Selected personnel does not cover this incident's city/municipality." });
        }
      }
    }

    // Update fields if provided
    if (status) incident.status = status;
    if (severity) incident.severity = severity;
    if (assignedAgency) incident.assignedAgency = assignedAgency;
    // Assign personnel explicitly or auto-assign the logged-in user
    if (assignedPersonnel) {
      incident.assignedPersonnel = assignedPersonnel;
    } else if (!incident.assignedPersonnel && !['citizen', 'admin'].includes(req.user.role)) {
      incident.assignedPersonnel = req.user.id;
    }

    // Log the action in response history
    incident.responseHistory.push({
      status: incident.status,
      notes: remarks || `Incident processed/updated by ${req.user.role}.`,
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await incident.save();

    const updatedIncident = await Incident.findById(incident._id)
      .populate('citizen', 'firstName lastName phoneNumber email')
      .populate('assignedPersonnel', 'firstName lastName role jurisdiction');

    res.status(200).json({
      message: 'Incident successfully processed and updated.',
      incident: updatedIncident
    });
  } catch (err) {
    console.error('Error processing incident:', err.message);
    res.status(500).json({ message: 'Server error during incident processing.' });
  }
};

module.exports = {
  createIncident,
  getIncidents,
  processIncident
};