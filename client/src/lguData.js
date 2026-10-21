import { useNotificationFeed } from "./services/NotificationProvider";
import { useCallback } from "react";
import { requireLgu } from "./auth";
import { incidentApi, personnelApi } from "./services/safelinkApi";
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
  profileUpdate: true,
  passwordChange: true,
  notificationPreferences: false,
});

export function useLguIncidents(user) {
  const loader = useCallback(() => { requireLgu(user); return incidentApi.list(); }, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [], live: ['incidents'] });
}

export function useLguIncident(user, id) {
  const loader = useCallback(async () => {
    requireLgu(user);
    return (await incidentApi.list()).find((incident) => incident.id === id) || null;
  }, [id, user?.id]);
  return useApiResource(loader, [id, user?.id], { enabled: Boolean(id && user?.id && !user?.isDevelopmentPreview), initialData: null, live: ['incidents'] });
}

export function useLguPersonnel(user) {
  const loader = useCallback(() => personnelApi.active(), [user?.id]);
  return useApiResource(loader, [user?.id], { enabled: Boolean(user?.id && !user?.isDevelopmentPreview), initialData: [] });
}

export function useLguNotifications(user) {
  const feed = useNotificationFeed();
  return { ...feed, available: feed.available && Boolean(user?.id), data: feed.available ? feed.data : [] };
}

export function processLguIncident(id, changes) { return incidentApi.process(id, changes); }
