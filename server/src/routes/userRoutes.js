const express = require('express');
const router = express.Router();
const { getPersonnelList } = require('../controllers/userController');
const { verifyAdminOrLGU } = require('../middleware/auth');

// GET Available Personnel List (LGU, Admin)
router.get('/personnel', verifyAdminOrLGU, getPersonnelList);

module.exports = router;