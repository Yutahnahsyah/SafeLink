const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/user');
const { canCoverIncidentLocation } = require('../utils/incidentAccess');
let active = null;
const roles = ['citizen', 'barangay_personnel', 'lgu_personnel', 'police_personnel'];
const userRoom = (id) => `user:${id}`;
const hint = (domains, eventId = crypto.randomUUID()) => ({ eventId, domains, occurredAt: new Date().toISOString() });

async function authenticate(token) {
  if (typeof token !== 'string' || !token || token.length > 4096) throw new Error('SESSION_EXPIRED');
  const req = { header: () => `Bearer ${token}` };
  await new Promise((resolve, reject) => verifyToken(req, {
    status(code) { this.code = code; return this; },
    json() { reject(new Error(this.code === 403 ? 'FORBIDDEN' : 'SESSION_EXPIRED')); },
  }, resolve));
  if (!roles.includes(req.user.role)) throw new Error('FORBIDDEN');
  const claims = jwt.verify(token, process.env.JWT_SECRET);
  return { user: req.user, expiresAt: claims.exp ? claims.exp * 1000 : Infinity };
}
function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Native clients still require a valid JWT.
  try {
    const known = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173',
      process.env.CLIENT_URL, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim())];
    return known.includes(origin) || new URL(origin).host === req.headers.host;
  } catch { return false; }
}

function attachRealtime(server, { recheckMs = 60000 } = {}) {
  const { Server } = require('socket.io');
  const io = new Server(server, { path: '/api/realtime/socket.io', serveClient: false, maxHttpBufferSize: 8192,
    cors: { origin: true }, allowRequest: (req, done) => done(null, allowedOrigin(req)) });
  io.use(async (socket, next) => {
    try { socket.data.session = await authenticate(socket.handshake.auth?.token); next(); }
    catch (error) { const failure = new Error('Connection authorization failed.'); failure.data = { code: error.message }; next(failure); }
  });
  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.session.user.id));
    // No client-controlled join/subscribe handlers. Reconnect always authenticates.
    const expire = () => { socket.emit('session:expired'); socket.disconnect(true); };
    let expiry;
    const checkExpiry = () => {
      const remaining = socket.data.session.expiresAt - Date.now();
      if (remaining <= 0) { expire(); return; }
      if (Number.isFinite(remaining)) expiry = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
      expiry?.unref();
    };
    checkExpiry();
    const recheck = setInterval(async () => {
      try {
        const current = await authenticate(socket.handshake.auth.token);
        if (JSON.stringify(current.user) !== JSON.stringify(socket.data.session.user)) expire();
      } catch { expire(); }
    }, recheckMs);
    recheck.unref();
    socket.on('disconnect', () => { clearTimeout(expiry); clearInterval(recheck); });
  });
  const hub = {
    io,
    notification(recipient, event, id) {
      // Resource hints and owned read receipts only; no text, evidence or incident data.
      const packet = hint(['notifications'], id ? `${event}:${id}` : undefined);
      if (event === 'notification:read') packet.read = id ? String(id) : 'all';
      io.to(userRoom(String(recipient))).emit(event, packet);
    },
    async incident(incident, previousAssignedPersonnel) {
      const recipients = new Set([String(incident.citizen?._id || incident.citizen)]);
      const city = incident.location?.address?.municipalityOrCity;
      if (typeof city === 'string' && city.trim()) {
        const escaped = city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const personnel = await User.find({ isVerified: true, status: 'active', role: { $in: roles.slice(1) },
          'jurisdiction.municipalityOrCity': { $regex: new RegExp(`^${escaped}$`, 'i') } }).select('_id role jurisdiction');
        for (const person of personnel) {
          if (!canCoverIncidentLocation(person, incident)) continue;
          // Barangay queues also need to remove reports claimed by a colleague.
          if (person.role !== 'police_personnel' || String(person._id) === String(incident.assignedPersonnel?._id || incident.assignedPersonnel)
            || String(person._id) === String(previousAssignedPersonnel)) recipients.add(String(person._id));
        }
      }
      const event = hint(['incidents', 'analytics']);
      for (const recipient of recipients) io.to(userRoom(recipient)).emit('incident:updated', event);
    },
  };
  active = hub;
  server.once('close', () => { if (active === hub) active = null; });
  return io;
}
function publishNotification(recipient, event, id) {
  try { active?.notification(recipient, event, id); }
  catch { console.error('REALTIME_NOTIFICATION_INVALIDATION_FAILED'); }
}
async function publishIncidentUpdate(incident, previousAssignedPersonnel) {
  if (!active) return;
  try { await active.incident(incident, previousAssignedPersonnel); }
  catch { console.error('REALTIME_INCIDENT_INVALIDATION_FAILED'); }
}
module.exports = { attachRealtime, publishNotification, publishIncidentUpdate };
