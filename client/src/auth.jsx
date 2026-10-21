import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "./routing";
import { loginAccount, registerCitizenAccount, sessionFromLoginPayload } from "./services/accountApi";
import { authApi } from "./services/safelinkApi";
import { clearSession, getAccessToken, markActivity, storeSession } from "./services/apiClient";
import { isVerifiedAccountShape, shouldShowCitizenSessionReminder } from "./services/authPolicy";
import CitizenSessionReminder from "./components/CitizenSessionReminder";

import { NotificationProvider } from "./services/NotificationProvider";

const AuthContext = createContext(null);

export const isCitizenPreview =
  import.meta.env.DEV && import.meta.env.VITE_CITIZEN_PREVIEW === "true";
export const isLguPreview =
  import.meta.env.DEV && import.meta.env.VITE_LGU_PREVIEW === "true";
export const isAdminPreview =
  import.meta.env.DEV && import.meta.env.VITE_ADMIN_PREVIEW === "true";
export const lguPreviewArea = isLguPreview
  ? (import.meta.env.VITE_LGU_PREVIEW_AREA || "Calasiao").trim()
  : "";

export function AuthProvider({ children }) {
  const { navigate, pathname } = useRouter();
  const [user, setUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(Boolean(getAccessToken()));
  const [restorationError, setRestorationError] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const revision = useRef(0);
  const restoration = useRef(null);
  useEffect(() => {
    let active = true;
    const version = revision.current;
    const token = getAccessToken();
    const controller = new AbortController();
    let timeout;
    const expired = () => { revision.current += 1; controller.abort(); clearTimeout(timeout); clearSession(); setUser(null); setIsRestoring(false); setRestorationError(null); };
    restoration.current = () => { controller.abort(); clearTimeout(timeout); };
    window.addEventListener("safelink:session-expired", expired);
    if (token) {
      setIsRestoring(true);
      setRestorationError(null);
      // Bound identity verification separately from page data. Cleanup also
      // ignores obsolete results, as recommended by react.dev/reference/react/useEffect.
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => { reject(new Error('Session verification timed out.')); controller.abort(); }, 8000);
      });
      Promise.race([authApi.me({ signal: controller.signal }), deadline]).then((account) => {
        if (!active || revision.current !== version || getAccessToken() !== token) return;
        if (!isVerifiedAccountShape(account)) throw Object.assign(new Error('Invalid authenticated account.'), { status: 401 });
        setUser(account);
        storeSession(token, account);
      }).catch((error) => {
        if (!active || revision.current !== version) return;
        setUser(null);
        if ([401, 403].includes(error?.status)) clearSession();
        else setRestorationError('We could not verify your session. Check your connection and try again.');
      }).finally(() => { clearTimeout(timeout); if (active && revision.current === version) setIsRestoring(false); });
    } else { clearSession(); setIsRestoring(false); }
    return () => { active = false; controller.abort(); clearTimeout(timeout); window.removeEventListener("safelink:session-expired", expired); };
  }, [restoreAttempt]);
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: isVerifiedAccountShape(user),
      isRestoring,
      restorationError,
      retryRestoration() { setIsRestoring(true); setRestorationError(null); setRestoreAttempt(value => value + 1); },
      isPreviewMode: false,
      isCitizenPreviewMode: false,
      isLguPreviewMode: false,
      isAdminPreviewMode: false,
      async login(credentials) {
        const version = ++revision.current;
        restoration.current?.();
        setIsRestoring(false);
        setRestorationError(null);
        const result = await loginAccount(credentials);
        if (revision.current !== version) throw new Error('Sign-in was cancelled. Please try again.');
        if (result?.mfaRequired || result?.mfaEnrollmentRequired) return result;
        setUser(result.user);
        setIsRestoring(false);
        storeSession(result.token, result.user);
        if (result.user.role === "citizen") markActivity();
        return result.user;
      },
      completeMfaLogin(payload) {
        const result = sessionFromLoginPayload(payload);
        revision.current += 1;
        setUser(result.user);
        setIsRestoring(false);
        setRestorationError(null);
        storeSession(result.token, result.user);
        if (result.user.role === "citizen") markActivity();
        return result.user;
      },
      register(values) { return registerCitizenAccount(values); },
      logout() {
        revision.current += 1;
        restoration.current?.();
        if (getAccessToken()) void authApi.logout().catch(() => console.warn('Sign-out could not be recorded by the server.'));
        setUser(null);
        setIsRestoring(false);
        setRestorationError(null);
        clearSession();
      },
      updateUser() { return { error: "PROFILE_UPDATE_NOT_AVAILABLE" }; },
    }),
    [isRestoring, restorationError, user],
  );
  return <AuthContext.Provider value={value}><NotificationProvider user={user}>
    {children}
    {shouldShowCitizenSessionReminder(pathname, user) && <CitizenSessionReminder userId={user.id} onTimeout={() => {
      value.logout();
      navigate("/login", { replace: true });
    }} />}
  </NotificationProvider></AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function requireCitizen(user) {
  if (!user || user.role !== "citizen") throw new Error("AUTH_REQUIRED");
  return user;
}

export function requireLgu(user) {
  if (!user || user.role !== "lgu_personnel") throw new Error("AUTH_REQUIRED");
  return user;
}

export function requireBarangay(user) {
  if (!user || user.role !== "barangay_personnel") throw new Error("AUTH_REQUIRED");
  return user;
}

export function requirePolice(user) {
  if (!user || user.role !== "police_personnel") throw new Error("AUTH_REQUIRED");
  return user;
}

export function requireAdmin(user) {
  if (!user || user.role !== "admin") throw new Error("AUTH_REQUIRED");
  return user;
}
