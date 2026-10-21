import boundaries from './pangasinan-municipalities.geojson.json' with { type: 'json' };
import { municipalitiesAt } from './incidentMunicipality.mjs';
import { normalizeMunicipalityName } from './municipalityNames.mjs';

export function findMunicipalityBoundary(name) {
  const key = normalizeMunicipalityName(name);
  if (!key) return null;
  const matches = boundaries.features.filter(feature =>
    [feature.properties.safelinkName, feature.properties.shapeName]
      .some(value => normalizeMunicipalityName(value) === key));
  return matches.length === 1 ? matches[0] : null;
}

export function assessMunicipalityCoordinates(longitude, latitude, municipality) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
    return { status: 'invalid_coordinates', municipalities: [] };
  }
  const municipalities = municipalitiesAt({ longitude, latitude });
  const key = normalizeMunicipalityName(municipality);
  const status = municipalities.some(name => normalizeMunicipalityName(name) === key) ? 'consistent'
    : municipalities.length ? 'municipality_coordinate_mismatch' : 'boundary_unconfirmed';
  return { status, municipalities };
}
