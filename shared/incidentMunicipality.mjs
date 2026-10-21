import boundary from './pangasinan-municipalities.geojson.json' with { type: 'json' };
import { ringPosition, validateIncidentCoordinates } from './incidentProvince.mjs';

const areas = boundary.features.map((feature) => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const bounds = polygons.map(([outer]) => outer.reduce((box, [x, y]) =>
    [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)],
  [Infinity, Infinity, -Infinity, -Infinity]));
  return { name: feature.properties.safelinkName, polygons, bounds };
});

export function municipalityBounds(name) {
  const area = areas.find((area) => area.name === name);
  if (!area) return null;
  return [[Math.min(...area.bounds.map(b => b[1])), Math.min(...area.bounds.map(b => b[0]))],
    [Math.max(...area.bounds.map(b => b[3])), Math.max(...area.bounds.map(b => b[2]))]];
}

// Include shared edges in both municipalities. Never arbitrarily choose one side.
// DENR's province polygon remains the authoritative acceptance gate.
export function municipalitiesAt(point) {
  if (validateIncidentCoordinates(point)) return [];
  const x = Number(point.longitude), y = Number(point.latitude);
  return areas.filter(area => area.polygons.some((polygon, i) => {
    const [west, south, east, north] = area.bounds[i];
    if (x < west || x > east || y < south || y > north) return false;
    const outer = ringPosition(polygon[0], x, y);
    return outer === 0 || (outer === 1 && !polygon.slice(1).some(hole => ringPosition(hole, x, y) === 1));
  })).map(area => area.name);
}

export function validateMunicipalityCoordinates(point) {
  const candidates = municipalitiesAt(point);
  // Dataset coastlines/vintages differ. A gap is not evidence of a conflict;
  // retain province-valid locations and require manual address confirmation.
  return candidates.length && !candidates.includes(point.municipalityOrCity)
    ? 'The selected municipality does not match the map pin. Select the exact incident location on the map.' : '';
}
