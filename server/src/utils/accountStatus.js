// Older registrations persisted active + unverified. Interpret those records
// consistently without a migration or changing administrative restrictions.
const accountStatus = (user) => user.role === 'citizen' && user.isVerified !== true && user.status === 'active'
  ? 'pending' : user.status;

const accountStatusExpression = {
  $cond: [{ $and: [
    { $eq: ['$role', 'citizen'] },
    { $ne: ['$isVerified', true] },
    { $eq: ['$status', 'active'] }
  ] }, 'pending', '$status']
};

module.exports = { accountStatus, accountStatusExpression };
