import { ApiError } from "./apiClient";
import { mapUserFromApi } from "./apiMappers";
import { authApi, personnelApi } from "./safelinkApi";

export const accountApiCapabilities = Object.freeze({
  loginCitizen: true, loginBarangay: true, loginLgu: true, loginPolice: true, loginAdmin: true,
  registerCitizen: true, applyPersonnel: true, verifyCitizenEmail: true,
  createBarangayPersonnel: true, createLguPersonnel: true, createPolicePersonnel: true,
  pendingPersonnel: true, approvePersonnel: true,
});

const portalRoles = Object.freeze({
  citizen: "citizen",
  barangay: "barangay_personnel",
  lgu: "lgu_personnel",
  police: "police_personnel",
  admin: "admin",
});

export async function loginAccount(portal, credentials) {
  const expectedRole = portalRoles[portal];
  if (!expectedRole) throw new ApiError("ROLE_NOT_SUPPORTED", "This SafeLink role is not supported.");
  const payload = await authApi.login({ email: credentials.email.trim().toLowerCase(), password: credentials.password });
  if (payload?.user?.role !== expectedRole) throw new ApiError("ROLE_MISMATCH", "This account belongs to a different SafeLink workspace.", 403);
  return { token: payload.token, user: mapUserFromApi(payload.user) };
}

export function registerCitizenAccount(values) { return authApi.registerCitizen(values); }
export function applyPersonnelAccount(values) { return authApi.applyPersonnel(values); }

export function verifyCitizenEmail(search = "") {
  const token = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("token");
  if (!token) return Promise.reject(new ApiError("VALIDATION_ERROR", "The verification link is incomplete.", 400));
  return authApi.verifyEmail(token);
}

export function fetchPendingPersonnel() { return personnelApi.pending(); }

export function createPersonnelAccount(type, values) {
  const role = { barangay: "barangay_personnel", lgu: "lgu_personnel", police: "police_personnel" }[type];
  if (!role) return Promise.reject(new ApiError("ROLE_NOT_SUPPORTED", "This personnel role is not supported."));
  return personnelApi.create({ ...values, role });
}

export function approvePersonnelAccount(id) { return personnelApi.approve(id); }
export function personnelListFrom(payload) { return Array.isArray(payload) ? payload : payload?.data || []; }
