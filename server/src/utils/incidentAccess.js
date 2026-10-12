const samePlace = (first, second) => (
  first?.trim().toLowerCase() === second?.trim().toLowerCase()
);

const canCoverIncidentLocation = (user, incident) => {
  if (user.role === 'barangay_personnel') {
    return samePlace(incident.location.address.barangay, user.jurisdiction?.barangay)
      && samePlace(incident.location.address.municipalityOrCity, user.jurisdiction?.municipalityOrCity);
  }
  if (['lgu_personnel', 'police_personnel'].includes(user.role)) {
    return samePlace(incident.location.address.municipalityOrCity, user.jurisdiction?.municipalityOrCity);
  }
  return false;
};

const isAssignedPersonnel = (user, incident) => (
  Boolean(incident.assignedPersonnel)
  && incident.assignedPersonnel.toString() === user.id.toString()
);

const canAccessIncident = (user, incident) => {
  if (user.role === 'lgu_personnel') return canCoverIncidentLocation(user, incident);
  if (user.role === 'barangay_personnel') {
    if (!canCoverIncidentLocation(user, incident)) return false;
    if (incident.barangaySupport) return true;
    return incident.assignedAgency === 'Barangay'
      && (!incident.assignedPersonnel || isAssignedPersonnel(user, incident));
  }
  return isAssignedPersonnel(user, incident);
};

const canManageAssignment = (user, incident) => (
  user.role === 'lgu_personnel' && canCoverIncidentLocation(user, incident)
);

module.exports = { canAccessIncident, canCoverIncidentLocation, canManageAssignment };
