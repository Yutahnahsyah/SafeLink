const express = require('express');
const { getAuditLogs, getAuditLog, exportRecentAuditLogs } = require('../controllers/auditLogController');
const { getAdminUsers, getAdminIncidentAnalytics } = require('../controllers/adminOverviewController');
const { verifyAdmin } = require('../middleware/auth');
const { listPublicationQueue, setPublication } = require('../controllers/communityMapController');

const router = express.Router();
router.get('/governance-overview', verifyAdmin, require('../controllers/governanceController').getGovernanceOverview);
const lguAccounts = require('../controllers/lguAccountController');
router.get('/personnel-accounts', verifyAdmin, (req, res, next) => { req.personnelDirectory = true; next(); }, getAdminUsers);
router.post('/personnel-accounts', verifyAdmin, lguAccounts.preparePersonnelAccount, lguAccounts.validateAccount, lguAccounts.createLguAccount);
router.patch('/personnel-accounts/:id', verifyAdmin, lguAccounts.preparePersonnelAccount, lguAccounts.validateAccount, lguAccounts.updateLguAccount);
router.post('/personnel-accounts/:id/password-reset', verifyAdmin, lguAccounts.preparePersonnelAccount, lguAccounts.requestLguPasswordReset);
router.post('/lgu-accounts', verifyAdmin, lguAccounts.validateAccount, lguAccounts.createLguAccount);
router.patch('/lgu-accounts/:id', verifyAdmin, lguAccounts.validateAccount, lguAccounts.updateLguAccount);
router.post('/lgu-accounts/:id/password-reset', verifyAdmin, lguAccounts.requestLguPasswordReset);

// GET View Audit Logs (Admin)
router.get('/audit-logs', verifyAdmin, getAuditLogs);
router.get('/audit-logs/export', verifyAdmin, exportRecentAuditLogs);
router.get('/audit-logs/:id', verifyAdmin, getAuditLog);
router.get('/users', verifyAdmin, getAdminUsers);
router.get('/incident-analytics', verifyAdmin, getAdminIncidentAnalytics);
router.get('/community-map/queue', verifyAdmin, listPublicationQueue);
router.patch('/community-map/:id', verifyAdmin, setPublication);

module.exports = router;
