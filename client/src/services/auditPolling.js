export function startAuditPolling({ load, onSuccess, onError, documentRef = document, schedule = setTimeout, cancel = clearTimeout }) {
  let active = true;
  let pending = false;
  let stopped = false;
  let timer;
  let timeout;
  let controller;

  const run = async () => {
    if (!active || stopped || pending || documentRef.visibilityState === "hidden") return;
    cancel(timer);
    pending = true;
    controller = new AbortController();
    timeout = schedule(() => controller.abort(), 20000);
    try {
      const data = await load(controller.signal);
      if (active) onSuccess(data);
    } catch (error) {
      if (active) {
        stopped = error?.status === 401 || error?.status === 403;
        onError(error);
      }
    } finally {
      cancel(timeout);
      pending = false;
      if (active && !stopped && documentRef.visibilityState !== "hidden") timer = schedule(run, 15000);
    }
  };
  const visibility = () => {
    cancel(timer);
    if (documentRef.visibilityState !== "hidden") void run();
  };
  documentRef.addEventListener("visibilitychange", visibility);
  void run();
  return () => {
    active = false;
    cancel(timer);
    cancel(timeout);
    controller?.abort();
    documentRef.removeEventListener("visibilitychange", visibility);
  };
}
