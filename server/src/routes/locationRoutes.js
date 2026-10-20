const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { getMunicipality, getBarangay, snapshot } = require('../utils/registrationLocations');
const { getStreetNames } = require('../services/streetSuggestions');
const { verifyToken } = require('../middleware/auth');
const { getIncidentAddress } = require('../services/incidentLocation');
const validQuery = (query, keys) => Object.entries(query).every(([key, value]) => keys.includes(key) && typeof value === 'string' && value.length <= 100);

// POST keeps precise coordinates out of URL/access logs. No database writes.
router.post('/incident-address', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, verifyToken,
  rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Location lookups are busy. Please enter the address manually or retry shortly.' } }), async (req, res) => {
    if (req.user.role !== 'citizen') return res.status(403).json({ message: 'Only Citizens can detect an incident address.' });
    const { latitude, longitude, accuracy } = req.body || {};
    if (Object.keys(req.query).length || Object.keys(req.body || {}).some((key) => !['latitude', 'longitude', 'accuracy'].includes(key))
      || (accuracy !== undefined && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0))
      || typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ message: 'Provide valid latitude and longitude.' });
    try {
      const data = await getIncidentAddress({ latitude, longitude, accuracy });
      return res.json({ data, source: 'OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright' });
    } catch (error) {
      if (error.message === 'OUTSIDE_PANGASINAN') return res.status(422).json({ code: 'OUTSIDE_PANGASINAN', message: 'That point is outside Pangasinan. Select the incident location manually.' });
      res.set('Retry-After', error.message === 'GEOCODER_BUSY' ? '2' : '30');
      return res.status(error.message === 'GEOCODER_BUSY' ? 429 : 503).json({ message: 'Address detection is unavailable. You can enter the address manually or retry shortly.' });
    }
  });

router.get('/barangays', (req, res) => {
  const municipality = getMunicipality(req.query.municipality);
  if (!validQuery(req.query, ['municipality']) || !municipality) return res.status(400).json({ message: 'Select a city or municipality in Pangasinan.' });
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json({ data: municipality.barangays, municipality: req.query.municipality, source: snapshot.source, retrievedOn: snapshot.retrievedOn });
});
router.get('/streets', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Street suggestions are busy. You can enter your street manually.' } }), async (req, res) => {
  const barangay = getBarangay(req.query.municipality, req.query.barangay);
  if (!validQuery(req.query, ['municipality', 'barangay']) || !barangay) return res.status(400).json({ message: 'Select a valid municipality and barangay.' });
  try {
    const data = await getStreetNames(req.query.municipality, barangay.name);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ data, source: 'OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright', scope: 'barangay', manualEntryAllowed: true });
  } catch {
    res.set('Retry-After', '30');
    return res.status(503).json({ message: 'Street suggestions are unavailable. Enter your street manually or retry shortly.', manualEntryAllowed: true });
  }
});
module.exports = router;
