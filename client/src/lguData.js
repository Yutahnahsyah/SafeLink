import { useCallback } from "react";
import { requireLgu } from "./auth";
import { incidentApi, notificationApi, personnelApi } from "./services/safelinkApi";
import { useApiResource } from "./services/useApiResource";

export const lguCapabilities = Object.freeze({
  incidents: true,
  incidentDetails: true,
  acknowledgeAssignment: false,
  startResponse: true,
  responseUpdates: true,
  resolveIncident: true,
  personnel: true,
  personnelAssignment: true,
  notifications: true,
  profileUpdate: false,
  passwordChange: true,
  notificationPreferences: false,
});

export function useLguIncidents(user) {
  const loader = useCallback(() => { requireLgu(user); return incidentApi.list(); }, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useLguIncident(user, id) {
  const loader = useCallback(async () => {
    requireLgu(user);
    return (await incidentApi.list()).find((incident) => incident.id === id) || null;
  }, [id, user?.id]);
  return useApiResource(loader, [id, user?.id], { enabled: Boolean(id && user?.id && !user?.isDevelopmentPreview), initialData: null });
}

export function useLguPersonnel(user) {
  const loader = useCallback(() => personnelApi.active(), [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useLguNotifications(user) {
  const loader = useCallback(async () => (await notificationApi.list({ page: 1, limit: 100 })).data, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function processLguIncident(id, changes) { return incidentApi.process(id, changes); }
