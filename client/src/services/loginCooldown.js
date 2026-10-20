const maximumSeconds = 30 * 60;
export const normalizeLoginIdentifier = value => String(value || '').trim().toLowerCase();
const key = email => `safelink_login_cooldown:${encodeURIComponent(normalizeLoginIdentifier(email))}`;

// Browser state is display-only. Clearing it never changes the backend cooldown.
export function readLoginCooldown(email, storage, now = Date.now()) {
  if (!normalizeLoginIdentifier(email)) return 0;
  try {
    const expiry = Number(storage?.getItem(key(email)));
    return Number.isFinite(expiry) && expiry > now && expiry - now <= maximumSeconds * 1000 ? expiry : 0;
  } catch { return 0; }
}
export function saveLoginCooldown(email, seconds, storage, now = Date.now()) {
  if (!normalizeLoginIdentifier(email) || !Number.isInteger(seconds) || seconds < 1 || seconds > maximumSeconds) return 0;
  const expiry = now + seconds * 1000;
  try { storage?.setItem(key(email), String(expiry)); } catch { /* In-memory display still works. */ }
  return expiry;
}
export function clearLoginCooldown(email, storage) {
  try { storage?.removeItem(key(email)); } catch { /* Backend remains authoritative. */ }
}
export function formatLoginCooldown(seconds) {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.ceil(remaining / 60);
  return {
    message: `Too many unsuccessful login attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    countdown: `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`,
  };
}
