const Incident = require('../models/incident');

const PUBLIC_ANALYTICS_STATUSES = ['Verified', 'In Progress', 'Resolved', 'Closed'];

const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid ISO date.`);
  return date;
};

const toCountMap = (groups) => groups.reduce((result, group) => {
  result[group._id] = group.count;
  return result;
}, {});

// @desc    Get role-scoped incident statistics and time trends
// @route   GET /api/analytics/overview
const getAnalyticsOverview = async (req, res) => {
  try {
    const from = parseDate(req.query.from, 'from');
    const to = parseDate(req.query.to, 'to');
    if (from && to && from > to) {
      return res.status(400).json({ message: 'The from date cannot be after the to date.' });
    }

    const match = {};
    const requestedCity = req.query.municipalityOrCity?.trim();
    const requestedBarangay = req.query.barangay?.trim();

    if (req.user.role === 'citizen') {
      match.status = { $in: PUBLIC_ANALYTICS_STATUSES };
      if (requestedCity || requestedBarangay) {
        return res.status(403).json({ message: 'Citizens cannot apply location filters to community analytics.' });
      }
    } else if (req.user.role === 'barangay_personnel') {
      match['location.address.barangay'] = req.user.jurisdiction?.barangay;
      match['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (['lgu_personnel', 'police_personnel'].includes(req.user.role)) {
      match['location.address.municipalityOrCity'] = req.user.jurisdiction?.municipalityOrCity;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: unrecognized role.' });
    }

    if (req.user.role === 'admin') {
      if (requestedCity) match['location.address.municipalityOrCity'] = requestedCity;
      if (requestedBarangay) match['location.address.barangay'] = requestedBarangay;
    } else if (requestedCity && requestedCity.toLowerCase()
      !== req.user.jurisdiction?.municipalityOrCity?.trim().toLowerCase()) {
      return res.status(403).json({ message: 'Access denied: analytics are limited to your municipality or city.' });
    } else if (requestedBarangay) {
      if (req.user.role === 'barangay_personnel'
        && requestedBarangay.toLowerCase() !== req.user.jurisdiction?.barangay?.trim().toLowerCase()) {
        return res.status(403).json({ message: 'Access denied: analytics are limited to your barangay.' });
      }
      match['location.address.barangay'] = requestedBarangay;
    }

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }

    const [result] = await Incident.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byIncidentType: [{ $group: { _id: '$incidentType', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
          byAgency: [{ $group: { _id: '$assignedAgency', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          dailyTrend: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const byStatus = toCountMap(result.byStatus);
    return res.json({
      scope: {
        role: req.user.role,
        municipalityOrCity: match['location.address.municipalityOrCity'] || null,
        barangay: match['location.address.barangay'] || null,
        from: from || null,
        to: to || null
      },
      summary: {
        totalReports: result.total[0]?.count || 0,
        activeReports: (byStatus.Submitted || 0) + (byStatus['Under Validation'] || 0)
          + (byStatus.Verified || 0) + (byStatus['In Progress'] || 0),
        resolvedReports: (byStatus.Resolved || 0) + (byStatus.Closed || 0),
        rejectedReports: byStatus.Rejected || 0
      },
      breakdowns: {
        status: byStatus,
        severity: toCountMap(result.bySeverity),
        incidentType: toCountMap(result.byIncidentType),
        assignedAgency: toCountMap(result.byAgency)
      },
      dailyTrend: result.dailyTrend.map((item) => ({ date: item._id, count: item.count }))
    });
  } catch (error) {
    console.error('Analytics fetch error:', error.message);
    return res.status(400).json({ message: error.message || 'Invalid analytics filters.' });
  }
};

module.exports = { getAnalyticsOverview };
