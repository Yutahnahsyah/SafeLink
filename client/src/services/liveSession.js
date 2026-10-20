// One connection per authenticated tab. Events invalidate data; HTTP remains authoritative.
export function startLiveSession({ connect, onDomains, onStatus, onExpired, onRead = () => {}, windowRef = window, documentRef = document,
  schedule = setTimeout, cancel = clearTimeout, interval = setInterval, stopInterval = clearInterval, now = Date.now }) {
  const socket = connect(), seen = new Set(), dirty = new Set();
  let closed = false, timer, reconnect, lastSync = 0, status = 'connecting';
  const setStatus = (value) => { status = value; if (!closed) onStatus(value); };
  const flush = () => {
    timer = undefined;
    if (closed || documentRef.visibilityState === 'hidden' || !dirty.size) return;
    const domains = [...dirty]; dirty.clear(); lastSync = now(); onDomains(domains);
  };
  const invalidate = (domains = ['incidents', 'analytics', 'notifications']) => {
    domains.filter((domain) => ['incidents', 'analytics', 'notifications'].includes(domain)).forEach((domain) => dirty.add(domain));
    if (!closed && !timer && documentRef.visibilityState !== 'hidden') timer = schedule(flush, 200);
  };
  const receive = (event, kind) => {
    if (closed || typeof event?.eventId !== 'string' || event.eventId.length > 200 || !Array.isArray(event.domains) || seen.has(event.eventId)) return;
    seen.add(event.eventId); if (seen.size > 500) seen.delete(seen.values().next().value);
    if (kind === 'notification:read' && (event.read === 'all' || /^[a-f\d]{24}$/i.test(event.read || ''))) onRead(event.read === 'all' ? null : event.read);
    invalidate(event.domains);
  };
  const expire = () => { if (!closed) { onExpired(); dispose(); } };
  socket.on('connect', () => { setStatus('connected'); invalidate(); });
  socket.on('disconnect', (reason) => {
    if (closed) return; setStatus('reconnecting');
    if (reason === 'io server disconnect') reconnect = schedule(() => { if (!closed) socket.connect(); }, 1000);
  });
  socket.on('connect_error', (error) => {
    if (['SESSION_EXPIRED', 'FORBIDDEN'].includes(error?.data?.code)) expire(); else setStatus('unavailable');
  });
  socket.on('session:expired', expire);
  ['incident:updated', 'notification:created', 'notification:read'].forEach((name) => socket.on(name, (event) => receive(event, name)));
  const wake = () => { if (documentRef.visibilityState !== 'hidden') { invalidate(); if (!socket.connected) socket.connect(); } };
  windowRef.addEventListener('focus', wake); windowRef.addEventListener('online', wake);
  documentRef.addEventListener('visibilitychange', wake);
  const fallback = interval(() => { if (status !== 'connected' || now() - lastSync >= 300000) invalidate(); }, 60000);
  function dispose() {
    if (closed) return; closed = true;
    cancel(timer); cancel(reconnect); stopInterval(fallback); dirty.clear(); seen.clear();
    windowRef.removeEventListener('focus', wake); windowRef.removeEventListener('online', wake); documentRef.removeEventListener('visibilitychange', wake);
    socket.removeAllListeners(); socket.disconnect();
  }
  setStatus('connecting'); socket.connect();
  return dispose;
}
