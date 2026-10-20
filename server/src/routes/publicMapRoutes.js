const router = require('express').Router();
const { getPublicResolvedMap } = require('../controllers/publicResolvedMapController');
const { getPublicStatistics } = require('../controllers/publicStatisticsController');

router.get('/resolved-incidents', getPublicResolvedMap);
router.get('/statistics', getPublicStatistics);

module.exports = router;
