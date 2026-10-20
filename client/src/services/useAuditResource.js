import { useEffect, useState } from "react";
import { auditApi } from "./safelinkApi";
import { startAuditPolling } from "./auditPolling";

export function useAuditResource(user, filters = {}) {
  const key = JSON.stringify(filters);
  const scope = JSON.stringify([user?.id, key]);
  const enabled = Boolean(user?.id && user.role === "admin" && !user.isDevelopmentPreview);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ data: null, status: "loading", error: null, updatedAt: null });
  useEffect(() => {
    setResult((current) => enabled && current.scope === scope && current.data
      ? { ...current, status: 'success', refreshing: true, error: null }
      : { scope, data: null, status: enabled ? "loading" : "idle", error: null, updatedAt: null });
    if (!enabled) return undefined;
    return startAuditPolling({
      load: (signal) => auditApi.list(JSON.parse(key), { signal }),
      onSuccess: (data) => setResult({ scope, data, status: "success", error: null, updatedAt: new Date() }),
      onError: (error) => setResult((current) => ({ ...current, data: [401,403].includes(error?.status) ? null : current.data, refreshing: false, status: "error", error })),
    });
  }, [user?.id, enabled, key, revision]);
  return { ...(result.scope === scope && enabled ? result : { data: null, status: enabled ? 'loading' : 'idle', error: null }), available: enabled, retry: () => setRevision((value) => value + 1) };
}

