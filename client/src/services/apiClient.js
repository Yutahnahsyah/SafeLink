// Development always uses Vite's same-origin proxy, including shared tunnel URLs.
// Production may still explicitly configure a separately hosted API.
export const API_BASE_URL = String(import.meta.env?.DEV ? "/api" : import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");

const TOKEN_KEY = "safelink_access_token";
const USER_KEY = "safelink_user";
const ACTIVITY_KEY = "safelink_last_activity";
const TRUSTED_MFA_DEVICE_KEY = "safelink_mfa_trusted_device";

export function getAccessToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function storeSession(token, user) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    if (user) window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* Storage can be unavailable in hardened browsers. */ }
}

export function getLastActivity() {
  try { return Number(window.sessionStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
}

export function markActivity() {
  try { window.sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* Storage can be unavailable. */ }
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(ACTIVITY_KEY);
  } catch { /* Nothing else to clear. */ }
}

export function getTrustedMfaDevice() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRUSTED_MFA_DEVICE_KEY) || "null");
    if (typeof value?.token !== "string" || value.token.length < 40 || value.token.length > 128 || !value?.expiresAt || new Date(value.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(TRUSTED_MFA_DEVICE_KEY);
      return null;
    }
    return value;
  } catch {
    try { window.localStorage.removeItem(TRUSTED_MFA_DEVICE_KEY); } catch { /* Nothing to clear. */ }
    return null;
  }
}

export function storeTrustedMfaDevice(token, expiresAt) {
  try {
    if (typeof token !== "string" || !token || !expiresAt) return;
    window.localStorage.setItem(TRUSTED_MFA_DEVICE_KEY, JSON.stringify({ token, expiresAt }));
  } catch { /* Local storage can be unavailable in hardened browsers. */ }
}

export function clearTrustedMfaDevice() {
  try { window.localStorage.removeItem(TRUSTED_MFA_DEVICE_KEY); } catch { /* Nothing to clear. */ }
}

export function storedSessionUser() {
  try { return JSON.parse(window.sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

export class ApiError extends Error {
  constructor(code, message, status = 0, fieldErrors = [], data = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
  }
}

export function shouldInvalidateSession(status, auth, requestToken, currentToken) {
  return status === 401 && auth && Boolean(requestToken) && currentToken === requestToken;
}

function codeFor(status, message) {
  const text = message.toLowerCase();
  if (!status) return "NETWORK_ERROR";
  if (status === 401) return /expired|invalid token/.test(text) ? "SESSION_EXPIRED" : "UNAUTHORIZED";
  if (status === 403 && /pending|approval/.test(text)) return "ACCOUNT_PENDING";
  if (status === 403 && /verify/.test(text)) return "EMAIL_NOT_VERIFIED";
  if (status === 403 && /suspend/.test(text)) return "ACCOUNT_SUSPENDED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if ((status === 400 || status === 409) && /already exists/.test(text)) return "ACCOUNT_EXISTS";
  if (status === 400 && /credential/.test(text)) return "INVALID_CREDENTIALS";
  if (status === 400 && /expired/.test(text)) return "LINK_EXPIRED";
  if (status === 400) return "VALIDATION_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_REJECTED";
}

function endpointUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}/${String(path).replace(/^\//, "")}`;
}

export async function apiRequest(path, { method = "GET", body, auth = true, responseType = "json", signal } = {}) {
  const token = getAccessToken();
  const formData = typeof FormData !== "undefined" && body instanceof FormData;
  let response;
  try {
    response = await fetch(endpointUrl(path), {
      method,
      signal,
      headers: {
        Accept: responseType === "blob" ? "*/*" : "application/json",
        ...(!formData && body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: formData ? body : JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", "SafeLink could not reach the server.");
  }

  if (response.ok) {
    if (responseType === "blob") return response.blob();
    if (response.status === 204) return null;
    return response.json().catch(() => ({}));
  }

  const payload = await response.json().catch(() => ({}));
  const fieldErrors = Array.isArray(payload?.errors) ? payload.errors.map((item) => ({ field: item.path || item.param || "", message: item.msg || "Invalid value." })) : [];
  const message = String(payload?.message || fieldErrors[0]?.message || "SafeLink could not complete this request.");
  const code = typeof payload?.code === "string" ? payload.code : codeFor(response.status, message);
  if (shouldInvalidateSession(response.status, auth, token, getAccessToken())) {
    clearSession();
    window.dispatchEvent(new CustomEvent("safelink:session-expired"));
  }
  throw new ApiError(code, message, response.status, fieldErrors, payload);
}

export function queryString(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}
