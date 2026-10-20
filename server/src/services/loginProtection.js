const crypto = require('crypto');
const LoginState = require('../models/loginState');
const cooldowns = [5, 10, 30].map(minutes => minutes * 60000);
const normalizeLoginEmail = value => String(value || '').trim().toLowerCase();
const stateError = () => Object.assign(new Error('Login security state is unavailable.'), { code: 'LOGIN_STATE_UNAVAILABLE' });
const writeOptions = { maxTimeMS: 5000, writeConcern: { w: 'majority', wtimeout: 5000 } };

function createLoginProtection({ store = LoginState, now = Date.now,
  secret = () => process.env.LOGIN_STATE_SECRET || process.env.JWT_SECRET,
  pause = () => new Promise(resolve => setTimeout(resolve, 25)), leaseMs = 30000, maxAttempts = 80 } = {}) {
  async function acquire(email) {
    let token, key, state;
    try {
      const signingKey = secret();
      if (!signingKey) throw stateError();
      key = crypto.createHmac('sha256', signingKey).update(`safelink:login:v1:${normalizeLoginEmail(email)}`).digest('hex');
      const created = new Date(now());
      try {
        await store.updateOne({ _id: key }, { $setOnInsert: {
          failedAttempts: 0, lockoutStage: 0, lockedUntil: null, leaseToken: null,
          leaseUntil: new Date(0), createdAt: created, updatedAt: created,
        } }, { ...writeOptions, upsert: true, setDefaultsOnInsert: false });
      } catch (error) { if (error.code !== 11000) throw error; } // Concurrent first use of the same indexed _id.
      token = crypto.randomUUID();
      const waitDeadline = performance.now() + 2000;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0 && performance.now() >= waitDeadline) break;
        const current = new Date(now());
        // Atomic lease claim across workers; never rely on a process-local mutex.
        // https://mongoosejs.com/docs/tutorials/findoneandupdate.html#atomic-updates
        state = await store.findOneAndUpdate({ _id: key, $or: [
          { leaseUntil: { $lte: current } }, { leaseUntil: { $exists: false } },
        ] }, { $set: { leaseToken: token, leaseUntil: new Date(current.getTime() + leaseMs) } },
        { ...writeOptions, returnDocument: 'after' }).lean();
        if (state) break;
        if (attempt + 1 < maxAttempts) await pause();
      }
      if (!state) throw Object.assign(new Error('Sign-in is being processed. Please try again shortly.'), { code: 'LOGIN_BUSY' });
    } catch (error) { throw error.code === 'LOGIN_BUSY' ? error : stateError(); }

    const remainingSeconds = () => Math.max(0, Math.ceil(((state.lockedUntil?.getTime() || 0) - now()) / 1000));
    const commit = async update => {
      try {
        // An expired/stale worker must never reset or overwrite a newer lease owner.
        const updated = await store.findOneAndUpdate({ _id: key, leaseToken: token, leaseUntil: { $gt: new Date(now()) } },
          { $set: { ...update, updatedAt: new Date(now()) } }, { ...writeOptions, returnDocument: 'after', runValidators: true }).lean();
        if (!updated) throw stateError();
        state = updated;
      } catch { throw stateError(); }
    };
    return {
      remainingSeconds,
      async recordFailure() {
        if (remainingSeconds()) return { locked: true, retryAfterSeconds: remainingSeconds(), started: false };
        const failures = state.failedAttempts + 1;
        const locked = failures >= 3;
        const stage = locked ? Math.min(3, state.lockoutStage + 1) : state.lockoutStage;
        const duration = locked ? cooldowns[stage - 1] : 0;
        await commit({ failedAttempts: locked ? 0 : failures, lockoutStage: stage,
          lockedUntil: locked ? new Date(now() + duration) : null });
        return { locked, retryAfterSeconds: remainingSeconds(), started: locked, cooldownSeconds: duration / 1000 };
      },
      async reset() {
        if (remainingSeconds()) throw stateError();
        await commit({ failedAttempts: 0, lockoutStage: 0, lockedUntil: null });
      },
      async release() {
        await store.updateOne({ _id: key, leaseToken: token },
          { $set: { leaseToken: null, leaseUntil: new Date(0) } }, writeOptions);
      },
    };
  }
  return { acquire };
}

module.exports = { createLoginProtection, loginProtection: createLoginProtection(), normalizeLoginEmail };
