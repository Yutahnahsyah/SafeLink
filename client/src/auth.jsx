import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "./routing";
import { loginAccount, registerCitizenAccount } from "./services/accountApi";
import { authApi } from "./services/safelinkApi";
import { clearSession, getAccessToken, storedSessionUser, storeSession } from "./services/apiClient";

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

const citizenPreviewUser = Object.freeze({
  id: "development-preview",
  role: "citizen",
  name: "Citizen Preview",
  isDevelopmentPreview: true,
});

const lguPreviewUser = Object.freeze({
  id: "lgu-development-preview",
  role: "lgu_personnel",
  name: "LGU Preview",
  jobTitle: `${lguPreviewArea} LGU Personnel`,
  office: `${lguPreviewArea} LGU`,
  jurisdiction: lguPreviewArea,
  municipality: lguPreviewArea,
  isDevelopmentPreview: true,
});

const adminPreviewUser = Object.freeze({
  id: "admin-development-preview",
  role: "admin",
  name: "Admin Preview",
  jobTitle: "Administrator",
  office: "SafeLink Provincial Operations",
  isDevelopmentPreview: true,
});

export function AuthProvider({ children }) {
  const { pathname } = useRouter();
  const [user, setUser] = useState(storedSessionUser);
  const [isRestoring, setIsRestoring] = useState(Boolean(getAccessToken()));
  useEffect(() => {
    let active = true;
    if (!getAccessToken()) { setIsRestoring(false); return undefined; }
    authApi.me().then((account) => {
      if (!active) return;
      setUser(account);
      storeSession(getAccessToken(), account);
    }).catch(() => {
      if (!active) return;
      clearSession();
      setUser(null);
    }).finally(() => { if (active) setIsRestoring(false); });
    const expired = () => { clearSession(); setUser(null); setIsRestoring(false); };
    window.addEventListener("safelink:session-expired", expired);
    return () => { active = false; window.removeEventListener("safelink:session-expired", expired); };
  }, []);
  const onAdminRoute = pathname === "/login/admin" || pathname.startsWith("/admin");
  const onLguRoute = pathname === "/login/lgu" || pathname.startsWith("/lgu");
  const onCitizenRoute = pathname === "/login/citizen" || pathname.startsWith("/citizen");
  const previewUser = onAdminRoute
    ? (isAdminPreview ? adminPreviewUser : null)
    : onLguRoute
      ? (isLguPreview ? lguPreviewUser : null)
      : (isCitizenPreview ? citizenPreviewUser : null);
  const displayUser = user || previewUser;
  const value = useMemo(
    () => ({
      user: displayUser,
      isAuthenticated: Boolean(user?.id),
      isRestoring,
      isPreviewMode: Boolean(previewUser && !user),
      isCitizenPreviewMode: Boolean(onCitizenRoute && isCitizenPreview && !user),
      isLguPreviewMode: Boolean(onLguRoute && isLguPreview && !user),
      isAdminPreviewMode: Boolean(onAdminRoute && isAdminPreview && !user),
      async login(portal, credentials) {
        const result = await loginAccount(portal, credentials);
        setUser(result.user);
        storeSession(result.token, result.user);
        return result.user;
      },
      register(values) { return registerCitizenAccount(values); },
      logout() {
        setUser(null);
        clearSession();
      },
      updateUser() { return { error: "PROFILE_UPDATE_NOT_AVAILABLE" }; },
    }),
    [displayUser, isRestoring, onAdminRoute, onCitizenRoute, onLguRoute, previewUser, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
