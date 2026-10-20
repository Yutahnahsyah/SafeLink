const { PANGASINAN_LOCATIONS } = require('./pangasinanLocations');
const { isWithinPangasinan } = require('./pangasinanBoundary');

const PUBLIC_CATEGORIES = Object.freeze([
  'Suspicious activities',
  'Dangerous road incidents',
  'Public fire or smoke incidents'
]);
const municipalities = new Set(PANGASINAN_LOCATIONS.map(({ municipalityOrCity }) => municipalityOrCity));

// The public API never sends the description, reporter, evidence, or source coordinates.
function assessPublication(incident) {
  if (!['Resolved', 'Closed'].includes(incident.status)) return 'unresolved';
  if (!PUBLIC_CATEGORIES.includes(incident.incidentType)) return 'sensitive_category';
  const address = incident.location?.address;
  if (!municipalities.has(address?.municipalityOrCity) || !String(address?.barangay || '').trim()
    || !isWithinPangasinan(incident.location?.longitude, incident.location?.latitude)) return 'invalid_location';
  if (!incident.closureConfirmation?.requestedAt) return 'missing_resolution_date';
  return null;
}

function decideResolvedPublication(incident) {
  if (incident.communityMapPublicationStatus === 'hidden') return { action: 'COMMUNITY_MAP_HELD', reason: 'manual_hide' };
  const reason = assessPublication(incident);
  incident.communityMapApprovedAt = reason ? null : new Date();
  incident.communityMapApprovedBy = null;
  incident.communityMapPublicationStatus = reason ? 'held' : 'published';
  incident.communityMapPublicationReason = reason;
  return { action: reason ? 'COMMUNITY_MAP_HELD' : 'COMMUNITY_MAP_AUTO_PUBLISHED', reason };
}

function withdrawPublication(incident) {
  if (incident.communityMapPublicationStatus === 'hidden') return null;
  if (!incident.communityMapApprovedAt) return null;
  incident.communityMapApprovedAt = null;
  incident.communityMapApprovedBy = null;
  incident.communityMapPublicationStatus = 'held';
  incident.communityMapPublicationReason = 'unresolved';
  return { action: 'COMMUNITY_MAP_WITHDRAWN', reason: 'unresolved' };
}

module.exports = { PUBLIC_CATEGORIES, assessPublication, decideResolvedPublication, withdrawPublication };
