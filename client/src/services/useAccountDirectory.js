import { useCallback, useEffect, useState } from "react";
import { adminOverviewApi } from "./safelinkApi";

// Debounce edits, cancel obsolete requests, and keep earlier responses from
// replacing a newer page. Pending controls are disabled immediately on render.
export function useAccountDirectory(user, filters, page) {
  const enabled = Boolean(user?.id && user.role === "admin" && !user.isDevelopmentPreview);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ data: null, status: "loading" });
  const query = JSON.stringify({ user: user?.id, filters, page });
  const key = JSON.stringify({ query, revision });
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let active = true;
    let timeout;
    const timer = setTimeout(async () => {
      timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const data = await adminOverviewApi.users({ ...filters, page }, { signal: controller.signal });
        if (active && !controller.signal.aborted) setResult({ key, query, userId: user.id, data, status: "success", error: null });
      } catch (error) {
        if (active) setResult((previous) => previous.query === query && previous.data && ![401, 403].includes(error?.status)
          ? { ...previous, key, status: 'success', refreshError: error }
          : { key, query, userId: user.id, data: null, status: "error", error: error.name === 'AbortError' ? new Error('The request timed out. Please retry.') : error });
      } finally {
        clearTimeout(timeout);
      }
    }, 200);
    return () => { active = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [key, enabled]);

  return {
    ...result,
    data: enabled && result.userId === user.id ? result.data : null,
    status: !enabled ? "idle" : result.key === key ? result.status : result.query === query && result.data ? 'success' : "loading",
    refreshing: enabled && result.key !== key && result.query === query && Boolean(result.data),
    refreshError: result.key === key ? result.refreshError : null,
    available: enabled,
    retry,
  };
}
