const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const EVIDENCE_DIRECTORY = path.resolve(__dirname, '../../uploads/evidence');
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EVIDENCE = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov']
};

fs.mkdirSync(EVIDENCE_DIRECTORY, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, EVIDENCE_DIRECTORY),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ALLOWED_EVIDENCE[file.mimetype];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'evidence'));
  }
  return callback(null, true);
};

const uploadEvidence = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_EVIDENCE_FILES,
    fileSize: MAX_EVIDENCE_FILE_SIZE
  }
});

module.exports = {
  EVIDENCE_DIRECTORY,
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_FILE_SIZE,
  uploadEvidence
};
