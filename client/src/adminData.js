import { useCallback } from "react";
import { requireAdmin } from "./auth";
import { analyticsApi, auditApi, incidentApi, notificationApi, personnelApi } from "./services/safelinkApi";
import { useApiResource } from "./services/useApiResource";

export const adminCapabilities = Object.freeze({
  reports: true, reportDetails: true, reviewDecision: true, priorityUpdate: true,
  assignments: true, reassignment: true, lguDirectory: false,
  personnel: true, personnelApproval: true, personnelCreation: true,
  notifications: true, analytics: true, auditLogs: true,
  users: false, userSuspension: true, userDeletion: true,
  profileUpdate: false, passwordChange: true, notificationPreferences: false,
});

export function useAdminReports(user) {
  const loader = useCallback(() => { requireAdmin(user); return incidentApi.list(); }, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useAdminReport(user, id) {
  const loader = useCallback(async () => { requireAdmin(user); return (await incidentApi.list()).find((item) => item.id === id) || null; }, [id, user?.id]);
  return useApiResource(loader, [id, user?.id], { enabled: Boolean(id && user?.id && !user?.isDevelopmentPreview), initialData: null });
}

export function useAdminPersonnel(user) {
  const loader = useCallback(() => personnelApi.pending(), [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useAdminNotifications(user) {
  const loader = useCallback(async () => (await notificationApi.list({ page: 1, limit: 100 })).data, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useAdminAnalytics(user) {
  const loader = useCallback(() => analyticsApi.overview(), [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: null });
}

export function useAuditLogs(user) {
  const loader = useCallback(() => auditApi.list({ page: 1, limit: 100 }), [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: { data: [], pagination: {} } });
}

export function processAdminIncident(id, changes) { return incidentApi.process(id, changes); }
export function approveAdminPersonnel(id) { return personnelApi.approve(id); }

const unavailable = (feature) => ({ data: null, status: "unavailable", available: false, error: `${feature} is not provided by the current backend.` });
export function getAdminLgus() { return unavailable("LGU directory information"); }
export function getAdminUsers() { return unavailable("Administrative user listing"); }
