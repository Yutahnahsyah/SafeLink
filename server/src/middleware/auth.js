const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const tokenString = token.startsWith('Bearer ') ? token.slice(7, token.length).trim() : token;
    const verified = jwt.verify(tokenString, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

const verifyAdminOrLGU = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'admin' || req.user.role === 'lgu_personnel') {
      next();
    } else {
      res.status(403).json({ message: 'Access forbidden: Requires Admin or LGU clearance.' });
    }
  });
};

module.exports = { verifyToken, verifyAdminOrLGU };