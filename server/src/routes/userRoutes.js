const express = require('express');
const router = express.Router();
const { getPersonnelList, getUserList } = require('../controllers/userController');
const { verifyAdmin, verifyAdminOrLGU } = require('../middleware/auth');

// GET Available Personnel List (LGU, Admin)
router.get('/personnel', verifyAdminOrLGU, getPersonnelList);

// GET Safe account directory for Administrator maintenance
router.get('/', verifyAdmin, getUserList);

module.exports = router;
