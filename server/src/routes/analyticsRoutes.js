const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getAnalyticsOverview } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', verifyToken, getAnalyticsOverview);

module.exports = router;
