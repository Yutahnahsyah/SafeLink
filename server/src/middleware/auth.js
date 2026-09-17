const jwt = require('jsonwebtoken');
const User = require('../models/user');

const verifyToken = async (req, res, next) => {
  const authorization = req.header('Authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. A Bearer token is required.' });
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ message: 'Access denied. A Bearer token is required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('_id role jurisdiction status isVerified');

    if (!user || !user.isVerified || user.status !== 'active') {
      return res.status(401).json({ message: 'Access denied. Your account is no longer active.' });
    }

    // Read current authorization data from the database so suspended users and role
    // changes take effect immediately instead of waiting for JWT expiration.
    req.user = {
      id: user._id.toString(),
      role: user.role,
      jurisdiction: user.jurisdiction
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const verifyAdminOrLGU = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'admin' || req.user.role === 'lgu_personnel') {
      return next();
    }
    return res.status(403).json({ message: 'Access forbidden: Requires Admin or LGU clearance.' });
  });
};

module.exports = { verifyToken, verifyAdminOrLGU };
