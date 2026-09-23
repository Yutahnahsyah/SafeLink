const express = require('express');
const { getAuditLogs } = require('../controllers/auditLogController');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// GET View Audit Logs (Admin)
router.get('/audit-logs', verifyAdmin, getAuditLogs);

module.exports = router;
