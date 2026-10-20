const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const authRequestLimit = positiveInteger(
  process.env.AUTH_RATE_LIMIT_MAX,
  200 // Shared networks/proxies retain a broad limit; account cooldowns are separate.
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authRequestLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication requests. Please try again later.' }
});

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
// The Vite proxy is same-origin to the browser and needs no tunnel-wide CORS grant.
// Explicit origins retain support for intentionally separate local/deployed clients.
const allowedOrigins = new Set([
  'http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173',
  process.env.CLIENT_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()),
].filter(Boolean));
app.use(cors({ origin: (origin, callback) => callback(null, allowedOrigins.has(origin)) }));
app.use('/api', apiLimiter);
app.use('/api/public', require('./routes/publicMapRoutes'));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/users', userRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error.message);
  res.status(error.status || 500).json({ message: 'Internal server error.' });
});

module.exports = app;
