import { apiRequest, queryString } from "./apiClient";
import { mapIncidentFromApi, mapMapFeature, mapNotificationFromApi, mapPersonnelFromApi, mapUserFromApi } from "./apiMappers";

export const authApi = {
  login: (credentials) => apiRequest("auth/login", { method: "POST", body: credentials, auth: false }),
  registerCitizen: (values) => apiRequest("auth/register-citizen", { method: "POST", body: values, auth: false }),
  applyPersonnel: (values) => apiRequest("auth/apply-personnel", { method: "POST", body: values, auth: false }),
  me: async () => mapUserFromApi((await apiRequest("auth/me")).user),
  verifyEmail: (token) => apiRequest(`auth/verify-email/${encodeURIComponent(token)}`, { auth: false }),
  resendVerification: (email) => apiRequest("auth/resend-verification", { method: "POST", body: { email }, auth: false }),
  forgotPassword: (email) => apiRequest("auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  resetPassword: (token, password) => apiRequest(`auth/reset-password/${encodeURIComponent(token)}`, { method: "POST", body: { password }, auth: false }),
};

export const incidentApi = {
  list: async () => (await apiRequest("incidents")).map(mapIncidentFromApi),
  create: async (body) => mapIncidentFromApi((await apiRequest("incidents", { method: "POST", body })).incident),
  process: async (id, body) => mapIncidentFromApi((await apiRequest(`incidents/${encodeURIComponent(id)}/process`, { method: "PATCH", body })).incident),
  map: async (filters = {}) => {
    const payload = await apiRequest(`incidents/map${queryString(filters)}`);
    return { items: (payload.features || []).map(mapMapFeature), metadata: payload.metadata };
  },
  boundary: () => apiRequest("incidents/map/boundary"),
  uploadEvidence: async (id, files) => {
    const form = new FormData();
    files.forEach((file) => form.append("evidence", file));
    return apiRequest(`incidents/${encodeURIComponent(id)}/evidence`, { method: "POST", body: form });
  },
  downloadEvidence: (incidentId, evidenceId) => apiRequest(`incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}`, { responseType: "blob" }),
};

export const notificationApi = {
  list: async (filters = {}) => {
    const payload = await apiRequest(`notifications${queryString(filters)}`);
    return { ...payload, data: (payload.data || []).map(mapNotificationFromApi) };
  },
  markRead: (id) => apiRequest(`notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllRead: () => apiRequest("notifications/read-all", { method: "PATCH" }),
};

export const analyticsApi = {
  overview: (filters = {}) => apiRequest(`analytics/overview${queryString(filters)}`),
};

export const personnelApi = {
  pending: async () => (await apiRequest("auth/pending-personnel")).map(mapPersonnelFromApi),
  active: async () => (await apiRequest("users/personnel")).map(mapPersonnelFromApi),
  approve: (id) => apiRequest(`auth/approve-personnel/${encodeURIComponent(id)}`, { method: "PUT" }),
  create: (values) => apiRequest("auth/register-personnel", { method: "POST", body: values }),
  setStatus: (id, status) => apiRequest(`auth/users/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  remove: (id) => apiRequest(`auth/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const auditApi = {
  list: (filters = {}) => apiRequest(`admin/audit-logs${queryString(filters)}`),
};
