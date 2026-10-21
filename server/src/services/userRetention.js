const User = require('../models/user');
const TrustedMfaDevice = require('../models/trustedMfaDevice');
const LoginState = require('../models/loginState');
const { hashIdentifier, recordAuditEvent } = require('../utils/auditLog');

const UNVERIFIED_ACCOUNT_TTL_MS = 12 * 60 * 60 * 1000;
const RETENTION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function removeUserSecurityArtifacts(user) {
  await Promise.all([
    TrustedMfaDevice.deleteMany({ user: user._id }),
    LoginState.deleteOne({ _id: hashIdentifier(user.email) })
  ]);
}

async function backfillUnverifiedAccountExpiry(now = new Date()) {
  const users = await User.find({
    isVerified: false,
    $or: [
      { unverifiedAccountExpiresAt: { $exists: false } },
      { unverifiedAccountExpiresAt: null }
    ]
  }).select('+unverifiedAccountExpiresAt createdAt');
  if (!users.length) return 0;

  const operations = users.map((user) => ({
    updateOne: {
      filter: { _id: user._id, isVerified: false, unverifiedAccountExpiresAt: null },
      update: { $set: { unverifiedAccountExpiresAt: new Date(user.createdAt.getTime() + UNVERIFIED_ACCOUNT_TTL_MS) } }
    }
  }));
  const result = await User.bulkWrite(operations, { ordered: false });
  return result.modifiedCount || 0;
}

async function purgeExpiredUnverifiedAccounts(now = new Date()) {
  const users = await User.find({
    isVerified: false,
    unverifiedAccountExpiresAt: { $lte: now }
  }).select('+unverifiedAccountExpiresAt _id email role');

  let deleted = 0;
  for (const user of users) {
    const result = await User.deleteOne({
      _id: user._id,
      isVerified: false,
      unverifiedAccountExpiresAt: { $lte: now }
    });
    if (!result.deletedCount) continue;
    deleted += 1;
    await removeUserSecurityArtifacts(user);
    await recordAuditEvent({
      targetUser: user._id,
      action: 'AUTH_UNVERIFIED_ACCOUNT_EXPIRED',
      outcome: 'success',
      details: { deletedRole: user.role, retentionHours: 12 }
    });
  }
  return deleted;
}

async function startUserRetention() {
  const backfilled = await backfillUnverifiedAccountExpiry();
  const deleted = await purgeExpiredUnverifiedAccounts();
  if (backfilled || deleted) console.log(`User retention: ${backfilled} expiry records initialized, ${deleted} expired unverified accounts deleted.`);
  const timer = setInterval(() => {
    void purgeExpiredUnverifiedAccounts().catch((error) => console.error('UNVERIFIED_ACCOUNT_RETENTION_FAILED', error.message));
  }, RETENTION_CHECK_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = {
  UNVERIFIED_ACCOUNT_TTL_MS,
  removeUserSecurityArtifacts,
  startUserRetention
};
