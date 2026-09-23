// Simplified mainland outline derived from the Philippine DENR Forest Management
// Bureau Provincial Boundary Feature Service (Pangasinan, PSGC 105500000).
// It is intentionally bundled so validation does not depend on a remote service.
// Source: https://fmbfsd.denr.gov.ph/server/rest/services/Hosted/Provincial_Boundary/FeatureServer/0
// Coordinates use GeoJSON order: [longitude, latitude].
const PANGASINAN_MAINLAND_BOUNDARY = [
  [119.75013, 15.96632], [119.76417, 15.93883], [119.79801, 15.92065],
  [119.84657, 15.96370], [119.89160, 15.89216], [119.90512, 15.86627],
  [119.89714, 15.82439], [119.95331, 15.81068], [120.00303, 15.82377],
  [120.07647, 15.83261], [120.15032, 15.81724], [120.17778, 15.73548],
  [120.20442, 15.69512], [120.25286, 15.61777], [120.27052, 15.64247],
  [120.31590, 15.65723], [120.34475, 15.70026], [120.38341, 15.74525],
  [120.42423, 15.75151], [120.46759, 15.72224], [120.52368, 15.75647],
  [120.55757, 15.78137], [120.57466, 15.82295], [120.60363, 15.86089],
  [120.61506, 15.81556], [120.65560, 15.82461], [120.70244, 15.83611],
  [120.74820, 15.84381], [120.79053, 15.82175], [120.81906, 15.79322],
  [120.86388, 15.85449], [120.86752, 15.88470], [120.90152, 15.91257],
  [120.92053, 15.96632], [120.90447, 16.01006], [120.89611, 16.04252],
  [120.87045, 16.11887], [120.84151, 16.16861], [120.80120, 16.18766],
  [120.76891, 16.19805], [120.69775, 16.19100], [120.63237, 16.18395],
  [120.55802, 16.21842], [120.52020, 16.23344], [120.45330, 16.20490],
  [120.42158, 16.18032], [120.40456, 16.13646], [120.36224, 16.09531],
  [120.33327, 16.07579], [120.32809, 16.06948], [120.27931, 16.04860],
  [120.23049, 16.03717], [120.20103, 16.04417], [120.17357, 16.03871],
  [120.12657, 16.04920], [120.09633, 16.06825], [120.10587, 16.09182],
  [120.08849, 16.11642], [120.10110, 16.12097], [120.08915, 16.13931],
  [120.08049, 16.16205], [120.05318, 16.17625], [120.04531, 16.19246],
  [120.03084, 16.19063], [120.00249, 16.19481], [119.97311, 16.21226],
  [119.94246, 16.23855], [119.91279, 16.26228], [119.92202, 16.27607],
  [119.91285, 16.29520], [119.92419, 16.31899], [119.92852, 16.33631],
  [119.93044, 16.36487], [119.92511, 16.38352], [119.90457, 16.38874],
  [119.88167, 16.39347], [119.85646, 16.36821], [119.81668, 16.36002],
  [119.78173, 16.31604], [119.77199, 16.27633], [119.77313, 16.24845],
  [119.76332, 16.20862], [119.76034, 16.18172], [119.77073, 16.14575],
  [119.76201, 16.10266], [119.75577, 16.05016], [119.77457, 16.02360],
  [119.75013, 15.96632]
];

const PANGASINAN_BOUNDS = {
  minLongitude: 119.75013,
  maxLongitude: 120.92053,
  minLatitude: 15.61777,
  maxLatitude: 16.39347
};

const pointIsOnSegment = (point, start, end) => {
  const [longitude, latitude] = point;
  const [startLongitude, startLatitude] = start;
  const [endLongitude, endLatitude] = end;
  const crossProduct = (latitude - startLatitude) * (endLongitude - startLongitude)
    - (longitude - startLongitude) * (endLatitude - startLatitude);
  if (Math.abs(crossProduct) > 1e-9) return false;

  const dotProduct = (longitude - startLongitude) * (endLongitude - startLongitude)
    + (latitude - startLatitude) * (endLatitude - startLatitude);
  if (dotProduct < 0) return false;

  const squaredLength = (endLongitude - startLongitude) ** 2
    + (endLatitude - startLatitude) ** 2;
  return dotProduct <= squaredLength;
};

const isWithinPangasinan = (longitude, latitude) => {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < PANGASINAN_BOUNDS.minLongitude || longitude > PANGASINAN_BOUNDS.maxLongitude
    || latitude < PANGASINAN_BOUNDS.minLatitude || latitude > PANGASINAN_BOUNDS.maxLatitude) {
    return false;
  }

  let inside = false;
  for (let currentIndex = 0, previousIndex = PANGASINAN_MAINLAND_BOUNDARY.length - 1;
    currentIndex < PANGASINAN_MAINLAND_BOUNDARY.length;
    previousIndex = currentIndex++) {
    const current = PANGASINAN_MAINLAND_BOUNDARY[currentIndex];
    const previous = PANGASINAN_MAINLAND_BOUNDARY[previousIndex];
    if (pointIsOnSegment([longitude, latitude], previous, current)) return true;

    const intersects = ((current[1] > latitude) !== (previous[1] > latitude))
      && (longitude < ((previous[0] - current[0]) * (latitude - current[1]))
        / (previous[1] - current[1]) + current[0]);
    if (intersects) inside = !inside;
  }
  return inside;
};

const getPangasinanBoundaryFeature = () => ({
  type: 'Feature',
  properties: {
    name: 'Pangasinan',
    psgcCode: '105500000',
    source: 'Philippine DENR Forest Management Bureau Provincial Boundary Feature Service',
    sourceUrl: 'https://fmbfsd.denr.gov.ph/server/rest/services/Hosted/Provincial_Boundary/FeatureServer/0',
    geometryScope: 'simplified mainland outline'
  },
  geometry: {
    type: 'Polygon',
    coordinates: [PANGASINAN_MAINLAND_BOUNDARY]
  }
});

module.exports = {
  PANGASINAN_BOUNDS,
  getPangasinanBoundaryFeature,
  isWithinPangasinan
};
