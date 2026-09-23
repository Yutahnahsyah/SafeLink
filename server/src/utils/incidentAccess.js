const samePlace = (first, second) => (
  first?.trim().toLowerCase() === second?.trim().toLowerCase()
);

const canCoverIncidentLocation = (user, incident) => {
  if (user.role === 'admin') return true;
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
  if (user.role === 'admin') return true;
  if (user.role === 'lgu_personnel') return canCoverIncidentLocation(user, incident);
  return isAssignedPersonnel(user, incident);
};

const canManageAssignment = (user, incident) => (
  user.role === 'admin'
  || (user.role === 'lgu_personnel' && canCoverIncidentLocation(user, incident))
);

module.exports = { canAccessIncident, canCoverIncidentLocation, canManageAssignment };
