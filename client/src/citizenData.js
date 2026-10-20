import { useNotificationFeed } from "./services/NotificationProvider";
import { useCallback } from "react";
import { requireCitizen } from "./auth";
import { incidentApi } from "./services/safelinkApi";
import { useApiResource } from "./services/useApiResource";

export const citizenCapabilities = Object.freeze({
  reports: true,
  reportSubmission: true,
  notifications: true,
  profileUpdate: false,
  passwordChange: true,
  notificationPreferences: false,
});

export function useCitizenReports(user) {
  const enabled = user?.role === "citizen" && !user?.isDevelopmentPreview;
  const loader = useCallback(() => { requireCitizen(user); return incidentApi.list(); }, [user?.id]);
  return useApiResource(loader, [user?.id], { enabled, initialData: [], live: ['incidents'] });
}

export function useCitizenReport(user, id) {
  const loader = useCallback(async () => {
    requireCitizen(user);
    const incidents = await incidentApi.list();
    return incidents.find((incident) => incident.id === id) || null;
  }, [id, user?.id]);
  return useApiResource(loader, [id, user?.id], { enabled: Boolean(id && user?.role === "citizen" && !user?.isDevelopmentPreview), initialData: null, live: ['incidents'] });
}

export function useCitizenNotifications(user) {
  const feed = useNotificationFeed();
  return { ...feed, available: feed.available && Boolean(user?.id), data: feed.available ? feed.data : [] };
}

export async function submitCitizenReport(user, values) {
  requireCitizen(user);
  const incident = await incidentApi.create({
    incidentType: values.type,
    citizenUrgency: values.citizenUrgency,
    description: [values.description.trim(), values.details.trim()].filter(Boolean).join("\n\n"),
    location: {
      address: {
        street: values.street.trim() || undefined,
        landmark: values.location.trim() || undefined,
        barangay: values.barangay.trim(),
        municipalityOrCity: values.municipalityOrCity,
        zipCode: values.zipCode.trim() || undefined,
      },
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    },
  });
  if (values.files.length) await incidentApi.uploadEvidence(incident.id, values.files);
  return incident;
}
