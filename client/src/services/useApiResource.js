import { useCallback, useEffect, useRef, useState } from "react";

export function useApiResource(loader, dependencies = [], { enabled = true, initialData = null } = {}) {
  const activeRequest = useRef(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ data: initialData, status: enabled ? "loading" : "idle", available: enabled, error: null });
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setResult({ data: initialData, status: "idle", available: false, error: null, retry });
      return undefined;
    }
    const requestId = ++activeRequest.current;
    setResult((current) => ({ ...current, status: "loading", available: true, error: null, retry }));
    Promise.resolve().then(loader).then((data) => {
      if (activeRequest.current === requestId) setResult({ data, status: "success", available: true, error: null, retry });
    }).catch((error) => {
      if (error?.name !== "AbortError" && activeRequest.current === requestId) setResult({ data: initialData, status: "error", available: true, error, retry });
    });
    return () => { if (activeRequest.current === requestId) activeRequest.current += 1; };
  }, [...dependencies, enabled, revision]);

  return { ...result, retry };
}
