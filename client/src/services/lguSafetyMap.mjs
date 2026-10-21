import { scopeLguRecords } from '../lguScope.js';

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
  const authorized = scopeLguRecords(candidates, jurisdiction);
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
