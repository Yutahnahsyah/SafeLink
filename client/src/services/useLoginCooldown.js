import { useEffect, useState } from 'react';
import { normalizeLoginIdentifier, readLoginCooldown, saveLoginCooldown, clearLoginCooldown } from './loginCooldown';

export function useLoginCooldown(email) {
  const [deadlines, setDeadlines] = useState({});
  const [, tick] = useState(0);
  const identifier = normalizeLoginIdentifier(email);
  let storage;
  try { storage = window.sessionStorage; } catch { /* Hardened browsers may block storage. */ }
  const deadline = Math.max(deadlines[identifier] || 0, readLoginCooldown(identifier, storage));
  const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const active = remainingSeconds > 0;
  useEffect(() => {
    if (!active) return undefined;
    const interval = window.setInterval(() => tick(value => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [deadline, active]);
  return {
    remainingSeconds,
    start(attemptedEmail, error) {
      if (error?.code !== 'LOGIN_LOCKED') return false;
      const expiry = saveLoginCooldown(attemptedEmail, error.data?.retryAfterSeconds, storage);
      if (!expiry) return false;
      setDeadlines(current => ({ ...current, [normalizeLoginIdentifier(attemptedEmail)]: expiry }));
      return true;
    },
    clear(attemptedEmail) {
      clearLoginCooldown(attemptedEmail, storage);
      setDeadlines(current => ({ ...current, [normalizeLoginIdentifier(attemptedEmail)]: 0 }));
    },
  };
}
