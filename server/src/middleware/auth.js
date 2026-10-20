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
    const user = await User.findById(payload.id).select('_id firstName lastName role jurisdiction status isVerified');

    if (!user || !user.isVerified || user.status !== 'active') {
      return res.status(401).json({ message: 'Access denied. Your account is no longer active.' });
    }

    if (['barangay_personnel', 'lgu_personnel', 'police_personnel'].includes(user.role)
      && (!user.jurisdiction?.municipalityOrCity?.trim()
        || (user.role === 'barangay_personnel' && !user.jurisdiction?.barangay?.trim()))) {
      return res.status(403).json({ message: 'Access denied. Ask your administrator to assign your jurisdiction.' });
    }

    req.user = {
      id: user._id.toString(),
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
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

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ message: 'Access forbidden: Requires Admin clearance.' });
  });
};

module.exports = { verifyToken, verifyAdminOrLGU, verifyAdmin };
