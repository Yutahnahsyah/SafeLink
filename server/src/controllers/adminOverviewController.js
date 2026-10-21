const User = require('../models/user');
const Incident = require('../models/incident');
const { accountStatus, accountStatusExpression } = require('../utils/accountStatus');

const roles = ['citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel', 'admin'];
const statuses = ['active', 'pending', 'suspended'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toCounts = (items = []) => Object.fromEntries(items.map((item) => [item._id || 'Unspecified', item.count]));

async function getAdminUsers(req, res) {
  const allowed = ['page', 'search', 'role', 'status', 'verified', 'municipality', 'sort', 'archived'];
  if (Object.keys(req.query).some((key) => !allowed.includes(key) || typeof req.query[key] !== 'string')) return res.status(400).json({ message: 'Invalid account filter.' });
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.personnelDirectory ? 25 : 5;
  if (!Number.isInteger(page) || page < 1 || page > 10000) return res.status(400).json({ message: 'Invalid page.' });
  if (req.query.role && !roles.includes(req.query.role)) return res.status(400).json({ message: 'Invalid role.' });
  if (req.query.status && !statuses.includes(req.query.status)) return res.status(400).json({ message: 'Invalid status.' });
  if (req.query.verified && !['true', 'false'].includes(req.query.verified)) return res.status(400).json({ message: 'Invalid verification filter.' });
  if (req.query.archived && !['true', 'false'].includes(req.query.archived)) return res.status(400).json({ message: 'Invalid archive filter.' });
  const search = (req.query.search || '').trim();
  if (search.length > 80) return res.status(400).json({ message: 'Search is too long.' });
  const query = {};
  query.archivedAt = req.query.archived === 'true' ? { $ne: null } : null;
  if (req.query.municipality) {
    if (!require('../utils/pangasinanLocations').PANGASINAN_LOCATIONS.some((item) => item.municipalityOrCity === req.query.municipality)) return res.status(400).json({ message: 'Invalid municipality.' });
    query['jurisdiction.municipalityOrCity'] = req.query.municipality;
  }
  if (req.query.sort && !['newest', 'oldest'].includes(req.query.sort)) return res.status(400).json({ message: 'Invalid sort order.' });
  if (req.query.role) query.role = req.query.role;
  if (req.personnelDirectory) {
    const personnel = ['barangay_personnel', 'lgu_personnel', 'police_personnel'];
    if (req.query.role && !personnel.includes(req.query.role)) return res.status(400).json({ message: 'Invalid personnel role.' });
    query.role = req.query.role || { $in: personnel };
    if (req.query.verified === 'false') return res.status(400).json({ message: 'The personnel directory contains authorized, verified officials only. Review unverified accounts in Account Management.' });
    query.isVerified = true;
  }
  if (req.query.status) query.$expr = { $eq: [accountStatusExpression, req.query.status] };
  if (req.query.verified) query.isVerified = req.query.verified === 'true';
  if (search) query.$or = ['firstName', 'lastName', 'email', 'jurisdiction.municipalityOrCity'].map((key) => ({ [key]: { $regex: escapeRegex(search), $options: 'i' } }));
  try {
    const [users, total, summary] = await Promise.all([
      User.find(query).select('_id firstName lastName middleInitial phoneNumber email role status isVerified jurisdiction archivedAt createdAt updatedAt lastLoginAt').sort({ createdAt: req.query.sort === 'oldest' ? 1 : -1, _id: req.query.sort === 'oldest' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(query),
      User.aggregate([{ $match: query }, { $set: { status: accountStatusExpression } }, { $facet: {
        total: [{ $count: 'count' }],
        verified: [{ $match: { isVerified: true } }, { $count: 'count' }],
        pending: [{ $match: { status: 'pending', isVerified: false } }, { $count: 'count' }],
        suspended: [{ $match: { status: 'suspended' } }, { $count: 'count' }],
        statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        roles: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
      } }]).option({ maxTimeMS: 10000 }),
    ]);
    const metrics = summary[0] || {};
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ data: users.map((user) => ({ ...user, status: accountStatus(user) })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary: {
      total: metrics.total?.[0]?.count || 0,
      verified: metrics.verified?.[0]?.count || 0,
      pending: metrics.pending?.[0]?.count || 0,
      suspended: metrics.suspended?.[0]?.count || 0,
      roles: toCounts(metrics.roles),
      statuses: toCounts(metrics.statuses),
    } });
  } catch (error) {
    console.error('ADMIN_USERS_QUERY_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Account directory is temporarily unavailable.' });
  }
}

async function getAdminIncidentAnalytics(req, res) {
  if (Object.keys(req.query).some((key) => key !== 'days' || typeof req.query[key] !== 'string')) return res.status(400).json({ message: 'Invalid analytics filter.' });
  const days = Number(req.query.days || 30);
  if (![7, 30, 90].includes(days)) return res.status(400).json({ message: 'Invalid analytics period.' });
  const from = new Date(Date.now() - days * 86400000);
  try {
    const [data] = await Incident.aggregate([{ $match: { createdAt: { $gte: from } } }, { $facet: {
      total: [{ $count: 'count' }],
      status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      category: [{ $group: { _id: '$incidentType', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      priority: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
      municipality: [{ $group: { _id: '$location.address.municipalityOrCity', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0] } } } }, { $sort: { count: -1 } }, { $limit: 20 }],
      dailyTrend: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    } }]).option({ maxTimeMS: 10000 });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ days, summary: { total: data.total[0]?.count || 0 }, breakdowns: {
      status: toCounts(data.status), category: toCounts(data.category), priority: toCounts(data.priority),
    }, municipality: data.municipality.map((item) => ({ name: item._id || 'Unspecified', total: item.count, active: item.active, resolved: item.resolved })),
    dailyTrend: data.dailyTrend.map((item) => ({ date: item._id, count: item.count })) });
  } catch (error) {
    console.error('ADMIN_ANALYTICS_QUERY_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Incident analytics are temporarily unavailable.' });
  }
}

module.exports = { getAdminUsers, getAdminIncidentAnalytics };
