const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog');
const User = require('../models/user');
const { safeDetails } = require('./auditSafety');
const hashIdentifier = (value) => crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
const outboxDirectory = () => process.env.AUDIT_OUTBOX_DIR || path.resolve(__dirname, '../../var/audit-outbox');
const persist = (event) => AuditLog.updateOne({ _id: event._id }, { $setOnInsert: event }, { upsert: true, runValidators: true });

async function recordAuditEvent({ req, actor = req?.user?.id || null, targetUser = null, incident = null, action, outcome, details = {} }) {
  const event = {
    _id: new mongoose.Types.ObjectId(), actor, targetUser, incident, action, outcome,
    createdAt: new Date(), requestId: req?.requestId || crypto.randomUUID(), details: safeDetails(details),
  };
  // Failed login targets are not authenticated actors.
  if (actor) {
    try {
      const identity = String(actor) === String(req?.user?.id) ? req.user : await User.findById(actor).select('firstName lastName role').lean();
      event.actorName = (identity?.name || [identity?.firstName, identity?.lastName].filter(Boolean).join(' ')).slice(0, 160) || null;
      event.actorRole = identity?.role || null;
    } catch { console.error('AUDIT_IDENTITY_LOOKUP_FAILED', String(event._id)); }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { await persist(event); return; }
    catch { if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1))); }
  }
  // Retain one stable ID through ambiguous database timeouts and recovery.
  try {
    const directory = outboxDirectory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const pending = path.join(directory, String(event._id) + '.pending');
    const handle = await fs.open(pending, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(event)); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(pending, path.join(directory, String(event._id) + '.json'));
    console.error('AUDIT_WRITE_QUEUED', String(event._id), action);
  } catch {
    // Business operations already committed must not invite duplicate client retries.
    console.error('CRITICAL_AUDIT_WRITE_LOST', String(event._id), action, event.requestId);
  }
}
let replaying = false;
async function replayAuditOutbox() {
  if (replaying) return;
  replaying = true;
  try {
    const directory = outboxDirectory();
    const files = await fs.readdir(directory).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    for (const name of files.filter((value) => /^[a-f0-9]{24}\.(json|pending)$/.test(value)).slice(0, 100)) {
      const file = path.join(directory, name);
      try {
        if (name.endsWith('.pending') && Date.now() - (await fs.stat(file)).mtimeMs < 30000) continue;
        const event = JSON.parse(await fs.readFile(file, 'utf8'));
        if (String(event._id) !== name.slice(0, 24)) throw new Error('Event ID mismatch');
        event.details = safeDetails(event.details);
        await persist(event);
        await fs.unlink(file);
      } catch { console.error('AUDIT_REPLAY_EVENT_FAILED', name); }
    }
  } catch { console.error('AUDIT_REPLAY_FAILED: pending records retained for retry'); }
  finally { replaying = false; }
}
function startAuditRecovery() {
  void replayAuditOutbox();
  const timer = setInterval(replayAuditOutbox, 15000);
  timer.unref();
  return timer;
}
module.exports = { hashIdentifier, recordAuditEvent, replayAuditOutbox, startAuditRecovery };
