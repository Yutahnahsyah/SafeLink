const dateTime = (value) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

export function mapUserFromApi(user = {}) {
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  return {
    ...user,
    id: user.id || user._id,
    name: [firstName, user.middleInitial ? `${user.middleInitial}.` : "", lastName].filter(Boolean).join(" "),
    accountStatus: user.status,
    jurisdiction: user.jurisdiction || null,
  };
}

export function formatIncidentLocation(location = {}) {
  const address = location.address || {};
  return [address.street, address.barangay, address.municipalityOrCity, address.zipCode].filter(Boolean).join(", ");
}

export function mapIncidentFromApi(incident = {}) {
  const history = Array.isArray(incident.responseHistory) ? incident.responseHistory : [];
  const latest = history.at(-1);
  const latitude = Number(incident.location?.latitude);
  const longitude = Number(incident.location?.longitude);
  return {
    ...incident,
    id: String(incident._id || incident.id || ""),
    type: incident.incidentType,
    category: incident.incidentType,
    title: incident.incidentType,
    priority: incident.severity,
    location: formatIncidentLocation(incident.location),
    municipality: incident.location?.address?.municipalityOrCity || "",
    barangay: incident.location?.address?.barangay || "",
    latitude,
    longitude,
    coords: Number.isFinite(latitude) && Number.isFinite(longitude) ? [longitude, latitude] : null,
    submittedAt: dateTime(incident.createdAt),
    latestUpdate: latest?.notes || "",
    statusHistory: history.map((item) => ({
      id: item._id,
      status: item.newStatus || item.status,
      message: item.notes,
      timestamp: dateTime(item.timestamp),
      eventType: item.eventType,
    })),
    responseUpdates: history.map((item) => ({ id: item._id, title: item.eventType?.replaceAll("_", " "), message: item.notes, timestamp: dateTime(item.timestamp) })),
    evidence: (incident.evidenceFiles || []).map((file) => ({ id: file._id || file.id, name: file.originalName, type: file.mimeType, size: file.size, downloadUrl: file.downloadUrl || `/incidents/${incident._id}/evidence/${file._id}` })),
    assignedPersonnelId: String(incident.assignedPersonnel?._id || incident.assignedPersonnel?.id || incident.assignedPersonnel || ""),
    assignedPersonnelRole: incident.assignedPersonnel?.role || "",
    assignedTo: incident.assignedPersonnel ? [incident.assignedPersonnel.firstName, incident.assignedPersonnel.lastName].filter(Boolean).join(" ") : incident.assignedAgency,
  };
}

export function mapMapFeature(feature = {}) {
  const properties = feature.properties || {};
  return {
    id: String(feature.id || ""),
    type: properties.incidentType,
    category: properties.incidentType,
    status: properties.status,
    priority: properties.severity,
    severity: properties.severity,
    assignedAgency: properties.assignedAgency,
    location: [properties.barangay, properties.municipalityOrCity].filter(Boolean).join(", "),
    municipality: properties.municipalityOrCity,
    barangay: properties.barangay,
    coords: feature.geometry?.coordinates || null,
    submittedAt: dateTime(properties.createdAt),
  };
}

export function mapNotificationFromApi(notification = {}) {
  return {
    ...notification,
    id: String(notification._id || notification.id || ""),
    unread: !notification.read,
    body: notification.message,
    timestamp: dateTime(notification.createdAt),
    incidentId: String(notification.incident?._id || notification.incident || ""),
    reportId: String(notification.incident?._id || notification.incident || ""),
  };
}

export function mapPersonnelFromApi(person = {}) {
  return {
    ...person,
    id: String(person._id || person.id || ""),
    name: [person.firstName, person.lastName].filter(Boolean).join(" "),
    requestedRole: person.role,
    locality: [person.jurisdiction?.barangay, person.jurisdiction?.municipalityOrCity].filter(Boolean).join(", "),
    status: person.status === "pending" ? "Pending" : person.status,
    requestedAt: dateTime(person.createdAt),
    availability: person.status === "active" ? "Active" : "Unavailable",
  };
}
