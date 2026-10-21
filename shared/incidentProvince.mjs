import boundary from './pangasinan-province.geojson.json' with { type: 'json' };

export const OUTSIDE_PANGASINAN_MESSAGE = 'SafeLink currently accepts incident reports within Pangasinan only.';

// Full DENR geometry, including offshore polygons. See PANGASINAN_BOUNDARY.md.
const polygons = boundary.features[0].geometry.coordinates;
const bounds = polygons.map(([outer]) => outer.reduce((box, [x, y]) =>
  [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)],
  [Infinity, Infinity, -Infinity, -Infinity]));

// -1 outside, 0 on the edge, 1 inside. Tolerance is numerical only (~0.01 mm),
// not a geographic buffer. A repeated closing vertex is a point, not an edge
// containing every possible coordinate.
export function ringPosition(ring, x, y) {
  let inside = false;
  const epsilon = 1e-10;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
    if (length === 0) {
      if (Math.hypot(x - ax, y - ay) <= epsilon) return 0;
      continue;
    }
    if (Math.abs((x - ax) * dy - (y - ay) * dx) <= epsilon * length
      && x >= Math.min(ax, bx) - epsilon && x <= Math.max(ax, bx) + epsilon
      && y >= Math.min(ay, by) - epsilon && y <= Math.max(ay, by) + epsilon) return 0;
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside ? 1 : -1;
}

export function isIncidentWithinPangasinan(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  return polygons.some((polygon, index) => {
    const [west, south, east, north] = bounds[index];
    if (longitude < west || longitude > east || latitude < south || latitude > north) return false;
    const outer = ringPosition(polygon[0], longitude, latitude);
    if (outer === -1) return false;
    if (outer === 0) return true;
    for (const hole of polygon.slice(1)) {
      const position = ringPosition(hole, longitude, latitude);
      if (position === 0) return true;
      if (position === 1) return false;
    }
    return true;
  });
}

export function validateIncidentCoordinates({ longitude, latitude }) {
  const numeric = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim()))
    ? Number(value) : NaN;
  return isIncidentWithinPangasinan(numeric(longitude), numeric(latitude)) ? '' : OUTSIDE_PANGASINAN_MESSAGE;
}
