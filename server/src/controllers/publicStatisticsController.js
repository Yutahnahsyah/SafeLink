const User = require('../models/user');
const Incident = require('../models/incident');
const { readPublicResolvedMap } = require('./publicResolvedMapController');

async function getPublicStatistics(req, res) {
  res.set('Cache-Control', 'no-store');
  if (Object.keys(req.query).length) {
    return res.status(400).json({ message: 'Public platform statistics do not support filters.' });
  }
  try {
    const [map, agencies, totalReports, activeReports] = await Promise.all([
      readPublicResolvedMap(),
      User.distinct('role', { status: 'active', isVerified: true,
        role: { $in: ['barangay_personnel', 'lgu_personnel', 'police_personnel'] } }).maxTimeMS(10000),
      Incident.countDocuments({}).maxTimeMS(10000),
      Incident.countDocuments({ status: { $in: [
        'Submitted', 'Under Barangay Review', 'Under Validation', 'Verified', 'In Progress',
      ] } }).maxTimeMS(10000),
    ]);
    return res.json({
      summary: {
        totalReports,
        activeReports,
        resolvedReports: map.metadata.totalReports,
        partnerAgencies: agencies.length,
      },
      definitions: {
        totalReports: 'All submitted reports across the platform, including resolved, closed, and rejected reports. Aggregate count only.',
        activeReports: 'Reports awaiting review or response: Submitted, Under Barangay Review, Under Validation, Verified, or In Progress. Aggregate count only.',
        resolvedReports: 'Publicly approved, successfully resolved reports only.',
        partnerAgencies: 'Agency types represented by active, verified personnel: Barangay, LGU, or Police. Not a count of offices or staff.',
      },
      notice: 'Submitted and active figures are platform-wide totals. Report details remain private. Resolved count includes publicly approved reports only.',
    });
  } catch (error) {
    console.error('PUBLIC_STATISTICS_FAILED', error.name);
    return res.status(503).json({ message: 'Platform statistics are temporarily unavailable. Please try again.' });
  }
}

module.exports = { getPublicStatistics };
