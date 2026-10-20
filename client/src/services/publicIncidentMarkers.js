const CATEGORY_COLORS = Object.freeze({
  'Suspicious activities': '#3b82f6',
  'Public fire or smoke incidents': '#f97316',
  'Dangerous road incidents': '#ef4444',
  'People needing assistance during flooding': '#14b8a6'
});

export const publicIncidentColor = category => CATEGORY_COLORS[category] || '#64748b';

export function clusterPublicIncidents(items, map, zoom) {
  const buckets = new Map();
  for (const item of items) {
    if (!Array.isArray(item.coords) || item.coords.length !== 2 || !item.coords.every(Number.isFinite)) continue;
    const pixel = map.project([item.coords[1], item.coords[0]], zoom);
    const key = zoom >= 11 ? item.coords.join(':') : `${Math.floor(pixel.x / 56)}:${Math.floor(pixel.y / 56)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.values()].flatMap(members => {
    const position = [members.reduce((sum, item) => sum + item.coords[1], 0) / members.length,
      members.reduce((sum, item) => sum + item.coords[0], 0) / members.length];
    const categories = [...new Set(members.map(item => item.category))].sort();
    return categories.map((category, index) => {
      const grouped = members.filter(item => item.category === category);
      return { id: `${grouped[0].id}-${category}`, category, members: grouped, position,
        color: publicIncidentColor(category), count: grouped.reduce((sum, item) => sum + (item.count || 1), 0),
        offset: (index - (categories.length - 1) / 2) * 18 };
    });
  });
}
