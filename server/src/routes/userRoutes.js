const express = require('express');
const router = express.Router();
const { getPersonnelList } = require('../controllers/userController');
const { verifyAdminOrLGU } = require('../middleware/auth');

// GET /api/users/personnel (Restricted to Admins and LGU personnel)
router.get('/personnel', verifyAdminOrLGU, getPersonnelList);

module.exports = router;