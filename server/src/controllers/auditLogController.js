const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog');

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const addObjectIdFilter = (query, value, field, res) => {
  if (!value) return true;
  if (!mongoose.isValidObjectId(value)) {
    res.status(400).json({ message: `Invalid ${field} filter.` });
    return false;
  }
  query[field] = value;
  return true;
};

// @desc    View immutable operational audit records
// @route   GET /api/admin/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const { actor, targetUser, incident, action, outcome, from, to } = req.query;
    const query = {};

    if (!addObjectIdFilter(query, actor, 'actor', res)
      || !addObjectIdFilter(query, targetUser, 'targetUser', res)
      || !addObjectIdFilter(query, incident, 'incident', res)) {
      return;
    }

    if (action) query.action = action;
    if (outcome) {
      if (!['success', 'failure'].includes(outcome)) {
        return res.status(400).json({ message: 'Invalid outcome filter.' });
      }
      query.outcome = outcome;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ message: 'Invalid from date filter.' });
        }
        query.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ message: 'Invalid to date filter.' });
        }
        query.createdAt.$lte = toDate;
      }
    }

    const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInteger(req.query.limit, 25, 100);
    const skip = (page - 1) * limit;

    const [auditLogs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actor', 'firstName lastName email role')
        .populate('targetUser', 'firstName lastName email role')
        .populate('incident', 'incidentType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    return res.json({
      data: auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Audit log fetch error:', error.message);
    return res.status(500).json({ message: 'Server error fetching audit logs.' });
  }
};

module.exports = { getAuditLogs };
