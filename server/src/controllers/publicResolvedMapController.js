const Incident = require('../models/incident');
const { assessPublication, PUBLIC_CATEGORIES } = require('../utils/communityPublicationPolicy');
const { getBarangay } = require('../utils/registrationLocations');
const { readFilters, groupPublicIncidents } = require('./communityMapController');

const MAX_MARKERS = 1500;
const DAY = 24 * 60 * 60 * 1000;
const validDate = value => value instanceof Date && Number.isFinite(value.getTime());

function readPublicFilters(query) {
  if (Object.hasOwn(query, 'status')) throw new Error('This public map only includes resolved reports.');
  const { barangay, ...common } = query;
  const filters = readFilters(common);
  if (barangay !== undefined && (typeof barangay !== 'string' || !filters.municipality
    || !getBarangay(filters.municipality, barangay))) throw new Error('Select a valid municipality and barangay.');
  return { ...filters, barangay: barangay ? getBarangay(filters.municipality, barangay).name : undefined };
}

// Shared by public markers and counters so publication eligibility cannot diverge.
async function readPublicResolvedMap(filters = {}) {
    const now = new Date();
    const manilaDayStart = Math.floor((now.getTime() + 8 * 60 * 60 * 1000) / DAY) * DAY - 8 * 60 * 60 * 1000;
    const recentStart = manilaDayStart - 29 * DAY;
    const cursor = Incident.find({
      status: 'Resolved', communityMapPublicationStatus: 'published',
      communityMapApprovedAt: { $type: 'date' }, incidentType: { $in: PUBLIC_CATEGORIES }
    }).select('-_id incidentType status communityMapApprovedAt communityMapPublicationStatus location.latitude location.longitude location.address.municipalityOrCity location.address.barangay createdAt closureConfirmation.requestedAt')
      .sort({ 'closureConfirmation.requestedAt': -1, _id: 1 }).maxTimeMS(10000).lean().cursor();
    const markers = new Map(), municipalities = new Set(), categories = new Set(), barangays = new Set(), matchingMunicipalities = new Set();
    let totalReports = 0, recentReports = 0, mappedReports = 0;
    // Stream all candidates so statistics never depend on the marker display limit.
    for await (const incident of cursor) {
      if (incident.status !== 'Resolved' || incident.communityMapPublicationStatus !== 'published'
        || !validDate(incident.communityMapApprovedAt) || incident.communityMapApprovedAt > now
        || assessPublication(incident)) continue;
      const resolvedAt = incident.closureConfirmation?.requestedAt;
      if (!validDate(incident.createdAt) || !validDate(resolvedAt)
        || resolvedAt < incident.createdAt || resolvedAt > now) continue;
      const municipality = incident.location.address.municipalityOrCity;
      const barangay = getBarangay(municipality, incident.location.address.barangay)?.name || '';
      municipalities.add(municipality);
      categories.add(incident.incidentType);
      if (filters.municipality === municipality && barangay) barangays.add(barangay);
      if ((filters.municipality && filters.municipality !== municipality)
        || (filters.barangay && filters.barangay !== barangay)
        || (filters.category && filters.category !== incident.incidentType)
        || (filters.from && resolvedAt < filters.from)
        || (filters.to && resolvedAt >= new Date(filters.to.getTime() + DAY))) continue;
      totalReports += 1;
      matchingMunicipalities.add(municipality);
      if (resolvedAt.getTime() >= recentStart) recentReports += 1;
      const feature = groupPublicIncidents([incident])[0];
      if (!feature) throw new Error('Public location could not be generalized.');
      // Only canonical barangay names may leave the API; free-text addresses never do.
      if (barangay) feature.properties.barangay = barangay;
      else delete feature.properties.barangay;
      const key = JSON.stringify([feature.geometry.coordinates, feature.properties]);
      if (markers.has(key)) {
        markers.get(key).properties.count += 1;
        mappedReports += 1;
      } else if (markers.size < MAX_MARKERS) {
        feature.id = `public-resolved-${markers.size}`;
        markers.set(key, feature);
        mappedReports += 1;
      }
    }
    return {
      type: 'FeatureCollection', features: [...markers.values()],
      metadata: { totalReports, municipalities: matchingMunicipalities.size, recentReports,
        recentDays: 30, mappedReports, markerLimit: MAX_MARKERS, truncated: mappedReports < totalReports,
        dateBasis: 'resolved', locationPrecision: 'Broad area cells of approximately 16 km; never exact incident locations.' },
      options: { municipalities: [...municipalities].sort(), categories: [...categories].sort(), barangays: [...barangays].sort() }
    };
}

// Public read-only projection. Counts and options are derived from the same eligible records.
async function getPublicResolvedMap(req, res) {
  res.set('Cache-Control', 'no-store'); // Revocations must take effect on the next request.
  let filters;
  try { filters = readPublicFilters(req.query); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    return res.json(await readPublicResolvedMap(filters));
  } catch (error) {
    console.error('PUBLIC_RESOLVED_MAP_FAILED', error.name);
    return res.status(500).json({ message: 'Resolved reports are temporarily unavailable. Please try again.' });
  }
}

module.exports = { getPublicResolvedMap, readPublicFilters, readPublicResolvedMap };
