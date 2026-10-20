const fs = require('fs/promises');
const path = require('path');
const Incident = require('../models/incident');
const { publishIncidentUpdate } = require('../services/realtime');
const { recordAuditEvent } = require('../utils/auditLog');
const { createNotification } = require('../utils/notifications');
const { canAccessIncident } = require('../utils/incidentAccess');
const {
  EVIDENCE_DIRECTORY, MAX_EVIDENCE_FILES, ALLOWED_EVIDENCE, cloudinary, cloudinaryEnabled
} = require('../middleware/evidenceUpload');

const removeUploadedFiles = async (files = []) => {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
};

const uploadToCloudinary = (file) => new Promise((resolve, reject) => {
  cloudinary.uploader.upload(file.path, {
    folder: 'safelink/evidence',
    resource_type: 'auto',
    type: 'authenticated',
    use_filename: false,
    unique_filename: true
  }, (error, result) => error ? reject(error) : resolve(result));
});

const removeCloudinaryAssets = async (assets = []) => {
  await Promise.all(assets.map((asset) => cloudinary.uploader.destroy(asset.public_id, {
    resource_type: asset.resource_type,
    type: 'authenticated',
    invalidate: true
  }).catch(() => undefined)));
};

const canAddEvidence = (user, incident) => (
  (user.role === 'citizen' && incident.citizen.toString() === user.id)
  || (user.role !== 'citizen' && canAccessIncident(user, incident))
);

// @desc    Attach protected image/video evidence to an incident
// @route   POST /api/incidents/:id/evidence
const addEvidence = async (req, res) => {
  let cloudinaryAssets = [];
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

    if (process.env.NODE_ENV === 'production' && !cloudinaryEnabled) {
      await removeUploadedFiles(files);
      return res.status(503).json({ message: 'Evidence storage is not configured.' });
    }

    if (cloudinaryEnabled) cloudinaryAssets = await Promise.all(files.map(uploadToCloudinary));
    const evidence = files.map((file, index) => ({
      storageName: cloudinaryEnabled ? cloudinaryAssets[index].public_id : file.filename,
      storageProvider: cloudinaryEnabled ? 'cloudinary' : 'local',
      storageResourceType: cloudinaryEnabled ? cloudinaryAssets[index].resource_type : undefined,
      originalName: path.basename(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: req.user.id
    }));
    incident.evidenceFiles.push(...evidence);
    await incident.save();
    if (cloudinaryEnabled) await removeUploadedFiles(files);
    void publishIncidentUpdate(incident);

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
    await removeCloudinaryAssets(cloudinaryAssets);
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
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.vary('Authorization');
  const retrievalError = (error) => {
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    res.removeHeader('Content-Disposition');
    res.removeHeader('Content-Length');
    res.type('application/json');
    if (error.code === 'ENOENT' || error.status === 404) {
      return res.status(404).json({ message: 'Evidence file is unavailable.' });
    }
    if (error.status === 416) return res.status(416).json({ message: 'Requested evidence range is not available.' });
    console.error('Evidence retrieval error:', error.name, error.code || 'unknown');
    return res.status(500).json({ message: 'Server error retrieving evidence.' });
  };
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid incident ID.' });
    if (!/^[a-f\d]{24}$/i.test(req.params.evidenceId)) return res.status(400).json({ message: 'Invalid evidence ID.' });
    const incident = await Incident.findById(req.params.id)
      // Select leaf fields only: MongoDB rejects a parent and its child in one projection.
      .select('citizen assignedAgency assignedPersonnel barangaySupport location evidenceFiles._id evidenceFiles.originalName evidenceFiles.mimeType +evidenceFiles.storageName +evidenceFiles.storageProvider +evidenceFiles.storageResourceType');
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    const hasAccess = (req.user.role === 'citizen' && incident.citizen.toString() === req.user.id)
      || (req.user.role !== 'citizen' && canAccessIncident(req.user, incident));
    if (!hasAccess) return res.status(403).json({ message: 'Access denied: you cannot view this evidence.' });

    const evidence = incident.evidenceFiles.id(req.params.evidenceId);
    if (!evidence) return res.status(404).json({ message: 'Evidence file not found.' });
    if (!Object.hasOwn(ALLOWED_EVIDENCE, evidence.mimeType)) {
      return res.status(415).json({ message: 'This evidence format is not supported.' });
    }
    if (typeof evidence.storageName !== 'string' || !evidence.storageName) {
      return res.status(500).json({ message: 'Evidence storage metadata is unavailable.' });
    }
    if (evidence.storageProvider === 'cloudinary') {
      if (!cloudinaryEnabled || !evidence.storageResourceType) return res.status(503).json({ message: 'Evidence storage is unavailable.' });
      const format = path.extname(evidence.originalName).slice(1);
      const downloadUrl = cloudinary.utils.private_download_url(evidence.storageName, format, {
        resource_type: evidence.storageResourceType,
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        attachment: true
      });
      return res.redirect(downloadUrl);
    }
    const filePath = path.resolve(EVIDENCE_DIRECTORY, evidence.storageName);
    if (path.dirname(filePath) !== EVIDENCE_DIRECTORY) {
      return res.status(400).json({ message: 'Invalid evidence file.' });
    }

    await fs.access(filePath);
    res.type(evidence.mimeType);
    // Express invokes this callback for asynchronous send/stat/stream failures.
    return res.download(filePath, path.basename(evidence.originalName || 'incident-evidence'), {
      cacheControl: false,
      lastModified: false,
      headers: { 'Content-Type': evidence.mimeType }
    }, (error) => { if (error) retrievalError(error); });
  } catch (error) {
    return retrievalError(error);
  }
};

module.exports = { addEvidence, downloadEvidence };
