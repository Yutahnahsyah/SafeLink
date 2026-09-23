const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getAnalyticsOverview } = require('../controllers/analyticsController');

const router = express.Router();

// GET View Safety Dashboard and Analytics (Citizen, Barangay, LGU, Police, Admin)
router.get('/overview', verifyToken, getAnalyticsOverview);

module.exports = router;
