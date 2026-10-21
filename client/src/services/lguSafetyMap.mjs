import { normalizeMunicipalityName } from '../../../shared/municipalityNames.mjs';

const loadBoundaryModule = () => import('../../../shared/lguJurisdiction.mjs');
export const isLguBoundaryError = (error) => ['LGU_BOUNDARY_NOT_FOUND', 'LGU_BOUNDARY_UNAVAILABLE'].includes(error?.code);

export async function loadLguSafetyMap(jurisdiction, request, loadBoundary = loadBoundaryModule) {
  // Use the jurisdiction from the authenticated account, never local database
  // users or a province-wide response from an older deployed boundary endpoint.
  let findMunicipalityBoundary;
  try {
    ({ findMunicipalityBoundary } = await loadBoundary());
  } catch {
    throw Object.assign(new Error('The municipality boundary could not be loaded. Please retry. Your assigned incidents remain available from Assigned Incidents.'), { code: 'LGU_BOUNDARY_UNAVAILABLE' });
  }
  const boundary = findMunicipalityBoundary(jurisdiction);
  if (!boundary) throw Object.assign(new Error('No municipality boundary matches your assigned jurisdiction. Ask your administrator to check the assigned municipality or city.'), { code: 'LGU_BOUNDARY_NOT_FOUND' });
  const payload = await request('incidents/map');
  return { ...payload, boundary };
}

// Values accepted by the existing incident model/map endpoint. These filters
// operate on its privacy-limited map response, never the full incident record.
export const MAP_FILTER_OPTIONS = Object.freeze({
  status: ['Submitted', 'Under Barangay Review', 'Under Validation', 'Verified', 'Rejected', 'In Progress', 'Resolved', 'Closed'],
  category: ['Suspicious activities', 'Missing or vulnerable persons', 'Harassment or unsafe encounters', 'Dangerous road incidents',
    'People requiring assistance', 'Public fire or smoke incidents', 'People needing assistance during flooding'],
  priority: ['Low', 'Medium', 'High', 'Critical'],
});
export const EMPTY_MAP_FILTERS = Object.freeze({ status: '', category: '', priority: '', barangay: '', date: '' });
export const MAP_DATE_OPTIONS = [['today', 'Today (Philippine time)'], ['7', 'Last 7 days'], ['30', 'Last 30 days']];

export function buildLguSafetyMap(payload, jurisdiction, filters = {}, now = Date.now()) {
  const candidates = (Array.isArray(payload?.features) ? payload.features : []).flatMap(feature => {
    const p = feature.properties || {}, coords = feature.geometry?.coordinates;
    if (feature.geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2
      || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) return [];
    return [{ id: String(feature.id || ''), category: p.incidentType, type: p.incidentType, status: p.status, priority: p.severity,
      municipality: p.municipalityOrCity, barangay: p.barangay || '', createdAt: p.createdAt,
      location: [p.barangay, p.municipalityOrCity].filter(Boolean).join(', '),
      time: typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt))
        ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(p.createdAt)) : 'Report date unavailable',
      coords: [coords[0], coords[1]], color: '#087d85' }];
  });
  const expected = normalizeMunicipalityName(jurisdiction);
  const authorized = candidates.filter(item => expected && normalizeMunicipalityName(item.municipality) === expected);
  const barangays = [...new Set(authorized.map(item => item.barangay).filter(value => typeof value === 'string' && value.trim()))]
    .sort((a, b) => a.localeCompare(b));
  const today = new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const since = filters.date === 'today' ? Date.parse(`${today}T00:00:00+08:00`)
    : ['7', '30'].includes(filters.date) ? now - Number(filters.date) * 86400000 : null;
  const items = authorized.filter(item => {
    if (['status', 'category', 'priority', 'barangay'].some(field => filters[field] && item[field] !== filters[field])) return false;
    if (!filters.date) return true;
    const created = typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : NaN;
    return since !== null && Number.isFinite(created) && created >= since && created <= now;
  });
  return { items, barangays, total: authorized.length };
}
