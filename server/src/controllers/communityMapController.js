const mongoose = require('mongoose');
const Incident = require('../models/incident');
const { PANGASINAN_LOCATIONS } = require('../utils/pangasinanLocations');
const { isWithinPangasinan } = require('../utils/pangasinanBoundary');
const { recordAuditEvent } = require('../utils/auditLog');
const { PUBLIC_CATEGORIES, assessPublication } = require('../utils/communityPublicationPolicy');
const { getBarangay } = require('../utils/registrationLocations');

const ELIGIBLE_STATUSES = Object.freeze(['Verified', 'In Progress', 'Resolved', 'Closed']);
const MIN_GROUP_SIZE = 3;
const GRID_DEGREES = 0.15; // Broad area cells, about 16 km north to south.
const MAX_RECORDS = 5000;
const municipalityNames = new Set(PANGASINAN_LOCATIONS.map((item) => item.municipalityOrCity));
const publicDate = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

function single(value, name) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 100) throw new Error(`${name} is invalid.`);
  return value;
}

function day(value, name) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must be YYYY-MM-DD.`);
  const check = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== value) throw new Error(`${name} is invalid.`);
  return new Date(`${value}T00:00:00+08:00`);
}

function readFilters(query) {
  const supported = new Set(['incidentType', 'status', 'municipality', 'from', 'to']);
  if (Object.keys(query).some((key) => !supported.has(key))) throw new Error('Unsupported community map filter.');
  const category = single(query.incidentType, 'Category');
  const status = single(query.status, 'Status');
  const municipality = single(query.municipality, 'Municipality');
  const from = day(single(query.from, 'From date'), 'From date');
  const to = day(single(query.to, 'To date'), 'To date');
  if (category && !PUBLIC_CATEGORIES.includes(category)) throw new Error('Category is not available on the community map.');
  if (status && !ELIGIBLE_STATUSES.includes(status)) throw new Error('Status is not available on the community map.');
  if (municipality && !municipalityNames.has(municipality)) throw new Error('Municipality is invalid.');
  if (from && to && from > to) throw new Error('From date cannot be after to date.');
  return { category, status, municipality, from, to };
}

function groupPublicIncidents(incidents) {
  const groups = new Map();
  const resolved = [];
  for (const incident of incidents) {
    const latitude = incident.location?.latitude;
    const longitude = incident.location?.longitude;
    if (!isWithinPangasinan(longitude, latitude)) continue;
    const municipality = incident.location?.address?.municipalityOrCity;
    if (!municipalityNames.has(municipality)) continue;
    const latCell = Math.floor(latitude / GRID_DEGREES);
    const lonCell = Math.floor(longitude / GRID_DEGREES);
    if (['Resolved', 'Closed'].includes(incident.status)) {
      const resolvedAt = incident.closureConfirmation?.requestedAt;
      if (!resolvedAt || !incident.createdAt || !String(incident.location?.address?.barangay || '').trim()) continue;
      resolved.push({
        type: 'Feature', id: `resolved-${resolved.length}`,
        geometry: { type: 'Point', coordinates: [(lonCell + 0.5) * GRID_DEGREES, (latCell + 0.5) * GRID_DEGREES] },
        properties: { municipalityOrCity: municipality, barangay: incident.location.address.barangay,
          incidentType: incident.incidentType, status: 'Resolved', count: 1, areaLevel: 'broad area',
          reportedDate: publicDate(incident.createdAt),
          resolvedDate: publicDate(resolvedAt) }
      });
      continue;
    }
    const key = `${municipality}|${latCell}|${lonCell}`;
    if (!groups.has(key)) groups.set(key, { municipality, latCell, lonCell, count: 0, categories: new Set(), statuses: new Set() });
    const group = groups.get(key);
    group.count += 1;
    group.categories.add(incident.incidentType);
    group.statuses.add(incident.status);
  }
  return [...resolved, ...[...groups.values()].filter((group) => group.count >= MIN_GROUP_SIZE).map((group) => ({
    type: 'Feature',
    id: `${group.municipality}-${group.latCell}-${group.lonCell}`,
    geometry: { type: 'Point', coordinates: [(group.lonCell + 0.5) * GRID_DEGREES, (group.latCell + 0.5) * GRID_DEGREES] },
    properties: {
      municipalityOrCity: group.municipality,
      incidentType: group.categories.size === 1 ? [...group.categories][0] : 'Multiple categories',
      status: group.statuses.size === 1 ? [...group.statuses][0] : 'Mixed statuses',
      count: group.count,
      countLabel: group.count < 10 ? '3–9' : group.count < 25 ? '10–24' : '25+',
      areaLevel: 'broad area'
    }
  }))];
}

async function getCommunityMap(req, res) {
  res.set('Cache-Control', 'no-store');
  let filters;
  try { filters = readFilters(req.query); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const match = {
    communityMapApprovedAt: { $type: 'date', $lte: new Date() },
    communityMapPublicationStatus: 'published',
    status: filters.status && filters.status !== 'Resolved' ? { $in: [] } : 'Resolved',
    incidentType: filters.category || { $in: PUBLIC_CATEGORIES }
  };
  if (filters.municipality) match['location.address.municipalityOrCity'] = filters.municipality;
  if (filters.from || filters.to) {
    match.createdAt = {};
    if (filters.from) match.createdAt.$gte = filters.from;
    if (filters.to) match.createdAt.$lt = new Date(filters.to.getTime() + 24 * 60 * 60 * 1000);
  }
  try {
    // Read-only projection: source coordinates never leave the server.
    const incidents = await Incident.find(match)
      .select('incidentType status location.latitude location.longitude location.address.municipalityOrCity location.address.barangay createdAt closureConfirmation.requestedAt communityMapApprovedAt communityMapPublicationStatus')
      .limit(MAX_RECORDS).lean();
    const now = new Date();
    const validDate = (value) => value instanceof Date && Number.isFinite(value.getTime());
    const safeIncidents = incidents.filter((item) => item.status === 'Resolved' && item.communityMapPublicationStatus === 'published'
      && validDate(item.communityMapApprovedAt) && item.communityMapApprovedAt <= now && !assessPublication(item)
      && validDate(item.createdAt) && validDate(item.closureConfirmation?.requestedAt)
      && item.createdAt <= item.closureConfirmation.requestedAt && item.closureConfirmation.requestedAt <= now
      && (!filters.status || filters.status === 'Resolved')
      && (!filters.category || filters.category === item.incidentType)
      && (!filters.municipality || filters.municipality === item.location.address.municipalityOrCity)
      && (!filters.from || item.createdAt >= filters.from)
      && (!filters.to || item.createdAt < new Date(filters.to.getTime() + 86400000)));
    const features = groupPublicIncidents(safeIncidents).map((feature) => {
      // Free-text barangays can contain private addresses. Only canonical names
      // from the selected municipality may appear in the public projection.
      const barangay = getBarangay(feature.properties.municipalityOrCity, feature.properties.barangay)?.name;
      if (barangay) feature.properties.barangay = barangay;
      else delete feature.properties.barangay;
      feature.properties.publicApproved = true;
      return feature;
    });
    return res.json({
      type: 'FeatureCollection', features,
      metadata: {
        returned: features.length,
        visibleReports: features.reduce((sum, feature) => sum + feature.properties.count, 0),
        activeReports: features.filter((feature) => feature.properties.status !== 'Resolved').reduce((sum, feature) => sum + feature.properties.count, 0),
        resolvedReports: features.filter((feature) => feature.properties.status === 'Resolved').reduce((sum, feature) => sum + feature.properties.count, 0),
        municipalities: new Set(features.map((feature) => feature.properties.municipalityOrCity)).size,
        resultLimit: MAX_RECORDS,
        truncated: incidents.length === MAX_RECORDS,
        minimumGroupSize: MIN_GROUP_SIZE,
        countMethod: 'Only approved resolved reports appear at generalized broad-area locations.'
      },
      options: { categories: PUBLIC_CATEGORIES, statuses: ELIGIBLE_STATUSES, municipalities: [...municipalityNames] }
    });
  } catch (error) {
    console.error('COMMUNITY_MAP_QUERY_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Community map is temporarily unavailable.' });
  }
}

async function listPublicationQueue(req, res) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isInteger(page) || page < 1 || page > 1000 || Object.keys(req.query).some((key) => key !== 'page')) return res.status(400).json({ message: 'Invalid publication queue page.' });
  try {
    const query = { status: { $in: ELIGIBLE_STATUSES } };
    const [incidents, total] = await Promise.all([Incident.find(query)
      .select('_id incidentType status location.address.municipalityOrCity location.address.barangay createdAt closureConfirmation.requestedAt communityMapApprovedAt communityMapPublicationStatus communityMapPublicationReason')
      .sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(), Incident.countDocuments(query)]);
    return res.json({ items: incidents.map((item) => ({
      id: String(item._id), category: item.incidentType, status: item.status,
      municipality: item.location?.address?.municipalityOrCity || '', barangay: item.location?.address?.barangay || '',
      createdAt: item.createdAt, resolvedAt: item.closureConfirmation?.requestedAt || null,
      approvedAt: item.communityMapApprovedAt || null,
      publicationStatus: item.communityMapPublicationStatus || (item.communityMapApprovedAt ? 'published' : 'pending'),
      publicationReason: item.communityMapPublicationReason || null
    })), pagination: { page, total, totalPages: Math.ceil(total / 25) } });
  } catch (error) {
    console.error('COMMUNITY_MAP_QUEUE_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Publication queue is temporarily unavailable.' });
  }
}

async function setPublication(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || typeof req.body?.approved !== 'boolean') return res.status(400).json({ message: 'A valid report and approval decision are required.' });
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    const eligible = ['Resolved', 'Closed'].includes(incident.status)
      ? !assessPublication(incident)
      : ELIGIBLE_STATUSES.includes(incident.status) && PUBLIC_CATEGORIES.includes(incident.incidentType)
        && municipalityNames.has(incident.location?.address?.municipalityOrCity)
        && isWithinPangasinan(incident.location?.longitude, incident.location?.latitude);
    if (req.body.approved && !eligible) {
      return res.status(400).json({ message: 'This report is not eligible for community publication.' });
    }
    incident.communityMapApprovedAt = req.body.approved ? new Date() : null;
    incident.communityMapApprovedBy = req.body.approved ? req.user.id : null;
    incident.communityMapPublicationStatus = req.body.approved ? 'published' : 'hidden';
    incident.communityMapPublicationReason = req.body.approved ? null : 'manual_hide';
    await incident.save();
    await recordAuditEvent({ req, incident: incident._id, action: req.body.approved ? 'COMMUNITY_MAP_APPROVED' : 'COMMUNITY_MAP_REVOKED', outcome: 'success', details: { incidentType: incident.incidentType } });
    return res.json({ id: String(incident._id), approvedAt: incident.communityMapApprovedAt,
      publicationStatus: incident.communityMapPublicationStatus });
  } catch (error) {
    console.error('COMMUNITY_MAP_PUBLICATION_FAILED', req.requestId, error.message);
    return res.status(500).json({ message: 'Publication decision could not be saved.' });
  }
}

module.exports = { getCommunityMap, listPublicationQueue, setPublication, groupPublicIncidents, readFilters };
