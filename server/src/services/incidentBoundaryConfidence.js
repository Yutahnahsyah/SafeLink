// Require the full uncertainty disk inside an administrative polygon, including
// clearance from holes. Project locally to metres for Pangasinan coordinates.
function containsUncertainty(geometry, point) {
  if (!Number.isFinite(point.accuracy) || point.accuracy < 0) return false;
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  if (!Array.isArray(polygons)) return false;
  const scale = Math.PI / 180 * 6371000;
  const project = ([lon, lat]) => [(lon - point.longitude) * scale * Math.cos(point.latitude * Math.PI / 180), (lat - point.latitude) * scale];
  return polygons.some((polygon) => {
    if (!Array.isArray(polygon) || !polygon.length) return false;
    let clearance = Infinity;
    const inside = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every((p) => Array.isArray(p) && p.length >= 2
        && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
        || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return false;
      let contained = false;
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = project(ring[i]), [bx, by] = project(ring[i + 1]);
        if ((ay > 0) !== (by > 0) && 0 < ax + (bx - ax) * -ay / (by - ay)) contained = !contained;
        const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
        clearance = Math.min(clearance, Math.hypot(ax + t * dx, ay + t * dy));
      }
      inside.push(contained);
    }
    // Extra clearance covers rounding in the short-lived coordinate cache.
    return inside[0] && !inside.slice(1).some(Boolean) && clearance > point.accuracy + 2;
  });
}
module.exports = { containsUncertainty };
