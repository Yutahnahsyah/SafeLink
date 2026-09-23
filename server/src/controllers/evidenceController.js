const fs = require('fs/promises');
const path = require('path');
const Incident = require('../models/incident');
const { recordAuditEvent } = require('../utils/auditLog');
const { createNotification } = require('../utils/notifications');
const { canAccessIncident } = require('../utils/incidentAccess');
const { EVIDENCE_DIRECTORY, MAX_EVIDENCE_FILES } = require('../middleware/evidenceUpload');

const removeUploadedFiles = async (files = []) => {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
};

const canAddEvidence = (user, incident) => (
  (user.role === 'citizen' && incident.citizen.toString() === user.id)
  || (user.role !== 'citizen' && canAccessIncident(user, incident))
);

// @desc    Attach protected image/video evidence to an incident
// @route   POST /api/incidents/:id/evidence
const addEvidence = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'Attach at least one evidence file.' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      await removeUploadedFiles(files);
      return res.status(404).json({ message: 'Incident not found.' });
    }
    if (!canAddEvidence(req.user, incident)) {
      await removeUploadedFiles(files);
      return res.status(403).json({ message: 'Access denied: you cannot add evidence to this incident.' });
    }
    if (incident.evidenceFiles.length + files.length > MAX_EVIDENCE_FILES) {
      await removeUploadedFiles(files);
      return res.status(400).json({ message: `An incident can contain at most ${MAX_EVIDENCE_FILES} uploaded evidence files.` });
    }

    const evidence = files.map((file) => ({
      storageName: file.filename,
      originalName: path.basename(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: req.user.id
    }));
    incident.evidenceFiles.push(...evidence);
    await incident.save();

    const addedEvidence = incident.evidenceFiles.slice(-evidence.length);
    await recordAuditEvent({
      req,
      incident: incident._id,
      action: 'INCIDENT_EVIDENCE_UPLOADED',
      outcome: 'success',
      details: { fileCount: addedEvidence.length, mimeTypes: addedEvidence.map((file) => file.mimeType) }
    });

    if (incident.citizen.toString() !== req.user.id) {
      await createNotification({
        recipient: incident.citizen,
        incident: incident._id,
        type: 'evidence_added',
        title: 'Evidence added to your report',
        message: 'Authorized personnel added supporting evidence to your incident report.'
      });
    }

    return res.status(201).json({
      message: 'Evidence uploaded successfully.',
      evidence: addedEvidence.map((file) => ({
        id: file._id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        uploadedAt: file.uploadedAt,
        downloadUrl: `/api/incidents/${incident._id}/evidence/${file._id}`
      }))
    });
  } catch (error) {
    await removeUploadedFiles(req.files);
    console.error('Evidence upload error:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid incident ID.' });
    }
    return res.status(500).json({ message: 'Server error uploading evidence.' });
  }
};

// @desc    Download a protected evidence file
// @route   GET /api/incidents/:id/evidence/:evidenceId
const downloadEvidence = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .select('citizen assignedPersonnel location evidenceFiles +evidenceFiles.storageName');
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    const hasAccess = (req.user.role === 'citizen' && incident.citizen.toString() === req.user.id)
      || (req.user.role !== 'citizen' && canAccessIncident(req.user, incident));
    if (!hasAccess) return res.status(403).json({ message: 'Access denied: you cannot view this evidence.' });

    const evidence = incident.evidenceFiles.id(req.params.evidenceId);
    if (!evidence) return res.status(404).json({ message: 'Evidence file not found.' });
    const filePath = path.resolve(EVIDENCE_DIRECTORY, evidence.storageName);
    if (path.dirname(filePath) !== EVIDENCE_DIRECTORY) {
      return res.status(400).json({ message: 'Invalid evidence file.' });
    }

    await fs.access(filePath);
    res.type(evidence.mimeType);
    return res.download(filePath, evidence.originalName);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'Evidence file is unavailable.' });
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid incident or evidence ID.' });
    return res.status(400).json({ message: 'Invalid evidence ID.' });
  }
};

module.exports = { addEvidence, downloadEvidence };
