const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog');
const { publicEvent } = require('../utils/auditSafety');
const { recordAuditEvent } = require('../utils/auditLog');
const roles = ['citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel', 'admin'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseFilters(params = {}) {
  const allowed = ['page', 'limit', 'actor', 'targetUser', 'incident', 'action', 'outcome', 'from', 'to', 'role', 'search', 'sort', 'view', 'scope'];
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.includes(key) || typeof value !== 'string' || value.length > 160) throw new Error('Invalid audit filter.');
  }
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value) || Number(value) > max) throw new Error('Invalid pagination.');
    return Number(value);
  };
  const page = integer(params.page, 1, 10000);
  const limit = integer(params.limit, params.view === 'recent' ? 6 : 25, params.view === 'recent' ? 10 : 100);
  const query = {};
  if (params.scope) {
    if (params.scope !== 'accounts' || params.action) throw new Error('Invalid audit scope.');
    query.action = { $regex: '^(AUTH_|PERSONNEL_|USER_|LGU_ACCOUNT_|LGU_PASSWORD_)' };
  }
  for (const key of ['actor', 'targetUser', 'incident']) {
    if (params[key]) {
      if (!/^[a-f\d]{24}$/i.test(params[key])) throw new Error('Invalid resource filter.');
      query[key] = new mongoose.Types.ObjectId(params[key]);
    }
  }
  if (params.action) {
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(params.action)) throw new Error('Invalid event type.');
    query.action = params.action;
  }
  if (params.outcome) {
    if (!['success', 'failure'].includes(params.outcome)) throw new Error('Invalid result.');
    query.outcome = params.outcome;
  }
  if (params.role && !roles.includes(params.role)) throw new Error('Invalid role.');
  if (params.sort && !['asc', 'desc'].includes(params.sort)) throw new Error('Invalid sort order.');
  if (params.view && params.view !== 'recent') throw new Error('Invalid audit view.');
  if (params.view === 'recent' && (params.search || params.role || page !== 1)) throw new Error('Invalid recent activity request.');
  for (const [key, operator] of [['from', '$gte'], ['to', '$lte']]) {
    if (!params[key]) continue;
    if (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(params[key])) throw new Error('Invalid date.');
    const date = new Date(params[key]);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid date.');
    if (params[key].length === 10 && new Date(`${params[key]}T00:00:00.000Z`).toISOString().slice(0, 10) !== params[key]) throw new Error('Invalid date.');
    query.createdAt ||= {};
    query.createdAt[operator] = date;
  }
  if (query.createdAt?.$gte > query.createdAt?.$lte) throw new Error('Start date must precede end date.');
  return { query, page, limit, sort: params.sort === 'asc' ? 1 : -1, role: params.role, search: params.search?.trim() || '', view: params.view };
}

// The lookup projects only display identity; credentials and contact details never enter the result.
const identityStages = [
  { $lookup: { from: 'users', localField: 'actor', foreignField: '_id', pipeline: [
    { $project: { firstName: 1, lastName: 1, role: 1 } }
  ], as: 'identity' } },
  { $set: { identity: { $arrayElemAt: ['$identity', 0] } } },
  { $set: {
    actorName: { $ifNull: ['$actorName', { $trim: { input: { $concat: [{ $ifNull: ['$identity.firstName', ''] }, ' ', { $ifNull: ['$identity.lastName', ''] }] } } }] },
    actorRole: { $ifNull: ['$actorRole', '$identity.role'] },
    resourceReference: { $convert: { input: { $ifNull: ['$incident', '$targetUser'] }, to: 'string', onNull: '', onError: '' } },
  } },
];
const projection = { _id: 1, actor: 1, actorName: 1, actorRole: 1, targetUser: 1, incident: 1, action: 1, outcome: 1, createdAt: 1, details: 1, requestId: 1 };

async function getAuditLogs(req, res) {
  let filters;
  try { filters = parseFilters(req.query); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    const { query, page, limit, role, search, sort, view } = filters;
    if (view === 'recent') {
      const data = await AuditLog.find(query).select(projection).sort({ createdAt: sort, _id: sort })
        .limit(limit).populate('actor', 'firstName lastName role').lean();
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ data: data.map(publicEvent) });
    }
    const isAuth = { $regexMatch: { input: '$action', regex: '^(AUTH_|LGU_PASSWORD_)' } };
    const isIncident = { $regexMatch: { input: '$action', regex: '^INCIDENT_' } };
    const isAdmin = { $regexMatch: { input: '$action', regex: '^(PERSONNEL_|USER_|SYSTEM_|AUDIT_|LGU_ACCOUNT_)' } };
    const summaryGroup = {
      _id: null, total: { $sum: 1 },
      authentication: { $sum: { $cond: [isAuth, 1, 0] } },
      incidents: { $sum: { $cond: [isIncident, 1, 0] } },
      administration: { $sum: { $cond: [isAdmin, 1, 0] } },
      failedAuthentication: { $sum: { $cond: [{ $and: [isAuth, { $eq: ['$outcome', 'failure'] }, { $eq: ['$action', 'AUTH_LOGIN'] }] }, 1, 0] } },
    };
    const respond = (data, rawSummary) => {
      const { _id, ...summary } = rawSummary || { total: 0, authentication: 0, incidents: 0, administration: 0, failedAuthentication: 0 };
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ data: data.map(publicEvent), summary, pagination: { page, limit, total: summary.total, totalPages: Math.ceil(summary.total / limit) } });
    };
    if (!role && !search) {
      const [data, summaryResult] = await Promise.all([
        AuditLog.find(query).select(projection).sort({ createdAt: sort, _id: sort })
          .skip((page - 1) * limit).limit(limit).populate('actor', 'firstName lastName role').lean(),
        AuditLog.aggregate([{ $match: query }, { $group: summaryGroup }]).option({ maxTimeMS: 10000 }),
      ]);
      return respond(data, summaryResult[0]);
    }
    const pipeline = [{ $match: query }, ...identityStages];
    if (role) pipeline.push({ $match: { actorRole: role } });
    if (search) {
      const regex = escapeRegex(search);
      pipeline.push({ $match: { $or: ['action', 'actorName', 'actorRole', 'resourceReference'].map((key) => ({ [key]: { $regex: regex, $options: 'i' } })) } });
    }
    pipeline.push({ $facet: {
      data: [{ $sort: { createdAt: sort, _id: sort } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: projection }],
      summary: [{ $group: summaryGroup }],
    } });
    const [result] = await AuditLog.aggregate(pipeline).option({ maxTimeMS: 10000 });
    return respond(result.data, result.summary[0]);
  } catch (error) {
    console.error('AUDIT_QUERY_FAILED', req.requestId);
    return res.status(500).json({ message: 'Audit history is temporarily unavailable. Please retry.' });
  }
}
async function getAuditLog(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid audit event ID.' });
  try {
    const event = await AuditLog.findById(req.params.id).select(projection).populate('actor', 'firstName lastName role').lean();
    if (!event) return res.status(404).json({ message: 'Audit event not found.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(publicEvent(event));
  } catch { return res.status(500).json({ message: 'Audit event is temporarily unavailable.' }); }
}

async function exportRecentAuditLogs(req, res) {
  try {
    const records = await AuditLog.find({}).select(projection).sort({ createdAt: -1, _id: -1 })
      .limit(100).populate('actor', 'firstName lastName role').lean();
    const fields = ['createdAt', 'action', 'actorName', 'actorRole', 'outcome', 'incident', 'targetUser', 'requestId'];
    const cell = (value) => {
      const plain = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(plain) ? `'${plain}` : plain;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [fields.join(','), ...records.map((raw) => {
      const event = publicEvent(raw);
      return fields.map((key) => cell(event[key])).join(',');
    })].join('\r\n');
    await recordAuditEvent({ req, action: 'AUDIT_EXPORT', outcome: 'success', details: {} });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="safelink-audit-recent.csv"');
    return res.type('text/csv; charset=utf-8').send(csv);
  } catch (error) {
    console.error('AUDIT_EXPORT_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Audit export is temporarily unavailable.' });
  }
}

module.exports = { getAuditLogs, getAuditLog, exportRecentAuditLogs, parseFilters };
