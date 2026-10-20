const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const { publicEvent } = require('../utils/auditSafety');

const PERSONNEL = ['barangay_personnel', 'lgu_personnel', 'police_personnel'];
const ACCOUNT_ACTIONS = '^(AUTH_|PERSONNEL_|LGU_ACCOUNT_|LGU_PASSWORD_|USER_|SYSTEM_|AUDIT_)';
const count = rows => rows?.[0]?.count || 0;
const personnelProjection = { _id: 1, firstName: 1, middleInitial: 1, lastName: 1, role: 1, status: 1, jurisdiction: 1, createdAt: 1 };

// Protected by verifyAdmin on the existing governance route. Read-only account/security overview.
async function getGovernanceOverview(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (Object.keys(req.query).length) return res.status(400).json({ message: 'The governance overview does not accept filters.' });
  const to = new Date();
  const from = new Date(to.getTime() - 86400000);
  try {
    const [users, security, events] = await Promise.all([
      User.aggregate([{ $facet: {
        total: [{ $count: 'count' }],
        activePersonnel: [{ $match: { role: { $in: PERSONNEL }, status: 'active', isVerified: true } }, { $count: 'count' }],
        suspended: [{ $match: { status: 'suspended' } }, { $count: 'count' }],
        unverified: [{ $match: { isVerified: false } }, { $count: 'count' }],
        missingJurisdiction: [{ $match: { role: { $in: PERSONNEL }, $or: [
          { 'jurisdiction.municipalityOrCity': { $in: [null, ''] } },
          { 'jurisdiction.municipalityOrCity': { $regex: '^\\s*$' } },
          { role: 'barangay_personnel', 'jurisdiction.barangay': { $in: [null, ''] } },
          { role: 'barangay_personnel', 'jurisdiction.barangay': { $regex: '^\\s*$' } }
        ] } }, { $count: 'count' }],
        recentPersonnel: [{ $match: { role: { $in: PERSONNEL } } }, { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 5 }, { $project: personnelProjection }]
      } }]).option({ maxTimeMS: 10000 }),
      AuditLog.aggregate([{ $match: { createdAt: { $gte: from, $lte: to }, action: { $regex: ACCOUNT_ACTIONS } } },
        { $facet: { total: [{ $count: 'count' }],
          failedLogins: [{ $match: { action: 'AUTH_LOGIN', outcome: 'failure' } }, { $count: 'count' }] } }
      ]).option({ maxTimeMS: 10000 }),
      AuditLog.find({ action: { $regex: ACCOUNT_ACTIONS } }, null, { maxTimeMS: 10000 })
        .select({ _id: 1, actor: 1, actorName: 1, actorRole: 1, targetUser: 1, action: 1, outcome: 1, createdAt: 1, requestId: 1, details: 1 })
        .sort({ createdAt: -1, _id: -1 }).limit(5).populate('actor', 'firstName lastName role').lean()
    ]);
    const accounts = users[0] || {}, activity = security[0] || {};
    return res.json({ generatedAt: to, window: { from, to, hours: 24 },
      metrics: { totalUsers: count(accounts.total), activePersonnel: count(accounts.activePersonnel),
        suspendedAccounts: count(accounts.suspended), securityEvents24h: count(activity.total) },
      attention: { suspendedAccounts: count(accounts.suspended), unverifiedAccounts: count(accounts.unverified),
        missingJurisdiction: count(accounts.missingJurisdiction), failedLogins24h: count(activity.failedLogins) },
      recentPersonnel: (accounts.recentPersonnel || []).map(person => Object.fromEntries(
        Object.keys(personnelProjection).filter(key => person[key] !== undefined).map(key => [key, person[key]]))),
      recentEvents: events.map(publicEvent)
    });
  } catch (error) {
    console.error('GOVERNANCE_OVERVIEW_FAILED', error.name);
    return res.status(503).json({ message: 'The governance overview is temporarily unavailable. Please try again.' });
  }
}

module.exports = { getGovernanceOverview };
