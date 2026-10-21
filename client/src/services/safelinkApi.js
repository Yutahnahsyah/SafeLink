import { apiRequest, queryString } from "./apiClient";
import { mapIncidentFromApi, mapMapFeature, mapNotificationFromApi, mapPersonnelFromApi, mapUserFromApi } from "./apiMappers";

export const locationApi = {
  barangays: (municipality, options = {}) => apiRequest(`locations/barangays${queryString({ municipality })}`, { ...options, auth: false }),
  streets: (municipality, barangay, options = {}) => apiRequest(`locations/streets${queryString({ municipality, barangay })}`, { ...options, auth: false }),
};

export const publicMapApi = {
  resolved: async (filters = {}) => {
    const payload = await apiRequest(`public/resolved-incidents${queryString(filters)}`, { auth: false });
    return { items: (payload.features || []).map(mapMapFeature), metadata: payload.metadata, options: payload.options };
  },
};

export const publicStatisticsApi = {
  overview: () => apiRequest('public/statistics', { auth: false }),
};

export const authApi = {
  changePassword: (values) => apiRequest('auth/change-password', { method: 'POST', body: values }),
  logout: () => apiRequest('auth/logout', { method: 'POST' }),
  login: (credentials) => apiRequest("auth/login", { method: "POST", body: credentials, auth: false }),
  mfaSetup: (mfaToken) => apiRequest('auth/mfa/setup', { method: 'POST', body: { mfaToken }, auth: false }),
  confirmMfaEnrollment: (mfaToken, code) => apiRequest('auth/mfa/confirm-enrollment', { method: 'POST', body: { mfaToken, code }, auth: false }),
  verifyMfa: (mfaToken, code) => apiRequest('auth/mfa/verify', { method: 'POST', body: { mfaToken, code }, auth: false }),
  recoverMfa: (mfaToken, recoveryCode) => apiRequest('auth/mfa/recover', { method: 'POST', body: { mfaToken, recoveryCode }, auth: false }),
  mfaSettingsSetup: () => apiRequest('auth/mfa/settings/setup', { method: 'POST' }),
  confirmMfaSettings: (code) => apiRequest('auth/mfa/settings/confirm', { method: 'POST', body: { code } }),
  disableMfaSettings: (code) => apiRequest('auth/mfa/settings/disable', { method: 'POST', body: { code } }),
  registerCitizen: (values) => apiRequest("auth/register-citizen", { method: "POST", body: values, auth: false }),
  applyPersonnel: (values) => apiRequest("auth/apply-personnel", { method: "POST", body: values, auth: false }),
  me: async (options = {}) => mapUserFromApi((await apiRequest("auth/me", options)).user),
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
    return { items: (payload.features || []).map(mapMapFeature), metadata: payload.metadata, options: payload.options };
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
  list: async (filters = {}, options = {}) => {
    const payload = await apiRequest(`notifications${queryString(filters)}`, options);
    return { ...payload, data: (payload.data || []).map(mapNotificationFromApi) };
  },
  markRead: (id) => apiRequest(`notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllRead: () => apiRequest("notifications/read-all", { method: "PATCH" }),
};

export const analyticsApi = {
  overview: (filters = {}) => apiRequest(`analytics/overview${queryString(filters)}`),
};

export const personnelApi = {
  directory: (filters) => apiRequest(`admin/personnel-accounts${queryString(filters)}`),
  createPersonnel: (values) => apiRequest('admin/personnel-accounts', { method: 'POST', body: values }),
  updatePersonnel: (id, values) => apiRequest(`admin/personnel-accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: values }),
  resetPersonnelPassword: (id) => apiRequest(`admin/personnel-accounts/${encodeURIComponent(id)}/password-reset`, { method: 'POST' }),
  createLgu: (values) => apiRequest('admin/lgu-accounts', { method: 'POST', body: values }),
  updateLgu: (id, values) => apiRequest(`admin/lgu-accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: values }),
  resetLguPassword: (id) => apiRequest(`admin/lgu-accounts/${encodeURIComponent(id)}/password-reset`, { method: 'POST' }),
  pending: async () => (await apiRequest("auth/pending-personnel")).map(mapPersonnelFromApi),
  active: async () => (await apiRequest("users/personnel")).map(mapPersonnelFromApi),
  approve: (id) => apiRequest(`auth/approve-personnel/${encodeURIComponent(id)}`, { method: "PUT" }),
  create: (values) => apiRequest("admin/personnel-accounts", { method: "POST", body: values }),
  setStatus: (id, status) => apiRequest(`auth/users/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  remove: (id) => apiRequest(`auth/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const auditApi = {
  list: (filters = {}, options = {}) => apiRequest(`admin/audit-logs${queryString(filters)}`, options),
  detail: (id, options = {}) => apiRequest(`admin/audit-logs/${encodeURIComponent(id)}`, options),
  exportRecent: () => apiRequest('admin/audit-logs/export', { responseType: 'blob' }),
};

export const adminOverviewApi = {
  governance: (options = {}) => apiRequest('admin/governance-overview', options),
  users: (filters = {}, options = {}) => apiRequest(`admin/users${queryString(filters)}`, options),
  incidents: (days = 30) => apiRequest(`admin/incident-analytics${queryString({ days })}`),
  communityMapQueue: (page = 1) => apiRequest(`admin/community-map/queue${queryString({ page })}`),
  setCommunityMapApproval: (id, approved) => apiRequest(`admin/community-map/${encodeURIComponent(id)}`, { method: 'PATCH', body: { approved } }),
};
