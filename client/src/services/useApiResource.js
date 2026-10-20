import { useCallback, useEffect, useRef, useState } from "react";

export function useApiResource(loader, dependencies = [], { enabled = true, initialData = null, live = [] } = {}) {
  const activeRequest = useRef(0);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(dependencies);
  const [result, setResult] = useState({ key, data: initialData, status: enabled ? "loading" : "idle", hasData: false, error: null });
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const liveKey = live.join(',');
  useEffect(() => {
    if (!enabled || !liveKey || typeof window === 'undefined') return undefined;
    const changed = (event) => { if (event.detail?.domains?.some((domain) => liveKey.split(',').includes(domain))) retry(); };
    window.addEventListener('safelink:resources-changed', changed);
    return () => window.removeEventListener('safelink:resources-changed', changed);
  }, [enabled, liveKey, retry]);

  useEffect(() => {
    if (!enabled) {
      setResult({ key, data: initialData, status: "idle", hasData: false, error: null });
      return undefined;
    }
    const requestId = ++activeRequest.current;
    setResult((current) => current.key === key && current.hasData
      ? { ...current, status: "success", refreshing: true, refreshError: null }
      : { key, data: initialData, status: "loading", hasData: false, error: null });
    const fail = (error) => {
      if (activeRequest.current !== requestId) return;
      setResult((current) => current.key === key && current.hasData && ![401, 403].includes(error?.status)
        ? { ...current, status: "success", refreshing: false, refreshError: error }
        : { key, data: initialData, status: "error", hasData: false, error });
    };
    const timeout = setTimeout(() => {
      fail(new Error("The request timed out. Please retry."));
      if (activeRequest.current === requestId) activeRequest.current += 1;
    }, 20000);
    Promise.resolve().then(() => activeRequest.current === requestId ? loader() : undefined).then((data) => {
      if (activeRequest.current === requestId) setResult({ key, data, status: "success", hasData: true, refreshing: false, error: null });
    }).catch((error) => {
      fail(error);
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); if (activeRequest.current === requestId) activeRequest.current += 1; };
  }, [...dependencies, enabled, revision]);

  if (!enabled || result.key !== key) return { data: initialData, status: enabled ? "loading" : "idle", available: enabled, error: null, retry };
  return { ...result, available: enabled, retry };
}
