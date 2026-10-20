import { pangasinanLocations } from '../data/pangasinanLocations.js';

// Existing Citizen Community Safety Map legend colors, shared by markers/legend.
export const COMMUNITY_MARKER_COLORS = Object.freeze({
  suspicious: '#087d85', road: '#e68632', fire: '#df5b4e', mixed: '#2469ae', nearby: '#075d80',
});
const categories = new Map([
  ['Suspicious activities', COMMUNITY_MARKER_COLORS.suspicious],
  ['Dangerous road incidents', COMMUNITY_MARKER_COLORS.road],
  ['Public fire or smoke incidents', COMMUNITY_MARKER_COLORS.fire],
]);
const municipalities = new Set(pangasinanLocations.map((place) => place.name));
export const communityIncidentColor = (category) => categories.get(category)
  || (category === 'Multiple categories' ? COMMUNITY_MARKER_COLORS.mixed : COMMUNITY_MARKER_COLORS.suspicious);

export function isVisibleCommunityIncident(item) {
  const coords = item?.coords;
  return item?.status === 'Resolved' && item.publicApproved === true && item.areaLevel === 'broad area'
    && categories.has(item.category) && municipalities.has(item.municipality)
    && Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite)
    && coords[0] >= 119.7 && coords[0] <= 121 && coords[1] >= 15.6 && coords[1] <= 16.5;
}

// Group only circles that overlap on screen, including across bucket boundaries.
// Keep every group at an approved backend point, without jitter or centroids.
export function groupCommunityIncidents(items, map, zoom) {
  const groups = [], buckets = new Map(), distance = 24;
  for (const item of items) {
    if (!isVisibleCommunityIncident(item)) continue;
    const position = [item.coords[1], item.coords[0]];
    const pixel = map.project(position, zoom);
    const x = Math.floor(pixel.x / distance), y = Math.floor(pixel.y / distance);
    let group;
    for (let dx = -1; dx <= 1 && !group; dx++) {
      for (let dy = -1; dy <= 1 && !group; dy++) {
        group = buckets.get(`${x + dx}:${y + dy}`)?.find((candidate) => Math.hypot(candidate.pixel.x - pixel.x, candidate.pixel.y - pixel.y) <= distance);
      }
    }
    if (!group) {
      group = { id: item.id, position, pixel, members: [], categories: new Set(), sameArea: true, area: item.coords.join(':') };
      groups.push(group);
      const key = `${x}:${y}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(group);
    }
    group.members.push(item);
    group.categories.add(item.category);
    group.sameArea &&= group.area === item.coords.join(':');
  }
  return groups.map((group) => ({ ...group, color: !group.sameArea ? COMMUNITY_MARKER_COLORS.nearby
    : group.categories.size > 1 ? COMMUNITY_MARKER_COLORS.mixed : communityIncidentColor(group.members[0].category) }));
}

export function formatCommunityDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Not available';
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}
