const { PANGASINAN_LOCATIONS, getPangasinanZipCode } = require('../utils/pangasinanLocations');
const { getMunicipality } = require('../utils/registrationLocations');
const { containsUncertainty } = require('./incidentBoundaryConfidence');

const clean = (value) => typeof value === 'string' && value.length <= 255 && !/[<>\p{Cc}\p{Cf}]/u.test(value) ? value.trim() : '';
// Only formatting aliases: no edit distance, prefix matching, or similar-name guesses.
const normalize = (value) => clean(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/^(?:(?:city|municipality|province) of|barangay|brgy\.?)\s+/u, '')
  .replace(/\s+city$/u, '').replace(/\bsta\.?\s+/gu, 'santa ').replace(/\bsto\.?\s+/gu, 'santo ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const exactMatch = (candidates, options) => {
  const names = new Set(candidates.map(normalize).filter(Boolean));
  const matches = options.filter((name) => names.has(normalize(name)));
  return matches.length === 1 ? matches[0] : '';
};
function resultDistance(result, point) {
  if (result?.lat == null || result?.lon == null) return Infinity;
  const lat = Number(result.lat), lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Infinity;
  const rad = Math.PI / 180;
  const a = Math.sin((lat - point.latitude) * rad / 2) ** 2
    + Math.cos(lat * rad) * Math.cos(point.latitude * rad) * Math.sin((lon - point.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function nearby(result, point) {
  return resultDistance(result, point) <= 100;
}

function resolveIncidentAddress(result, point) {
  const address = result?.address || {};
  const state = normalize(address.state);
  if ((clean(address.country_code) && address.country_code.toLowerCase() !== 'ph')
    || (clean(address.province) && normalize(address.province) !== 'pangasinan')
    || (state && !['pangasinan', 'ilocos', 'ilocos region', 'region i', 'region 1'].includes(state))) throw new Error('GEOCODER_ADDRESS_MISMATCH');
  const candidateMunicipality = exactMatch([address.city, address.town, address.municipality, address.county], PANGASINAN_LOCATIONS.map((item) => item.municipalityOrCity));
  const options = getMunicipality(candidateMunicipality)?.barangays.map((item) => item.name) || [];
  const candidate = exactMatch([address.village, address.suburb, address.quarter, address.city_district, address.district,
    /^(barangay|brgy\.?)[\s]/i.test(clean(address.neighbourhood)) ? address.neighbourhood : ''], options);
  const administrative = result?.category === 'boundary' && result.type === 'administrative';
  const barangayBoundary = candidate && administrative && String(result.extratags?.admin_level) === '10'
    && normalize(result.name) === normalize(candidate) && containsUncertainty(result.geojson, point);
  // Reverse lookup returns the nearest mapped object, which may be far away.
  // A municipality boundary can have a distant centroid, so accept its actual
  // containing geometry instead of applying the street/POI distance rule to it.
  const municipalityBoundary = administrative
    && ['6', '8'].includes(String(result.extratags?.admin_level))
    && normalize(result.name) === normalize(candidateMunicipality)
    && containsUncertainty(result.geojson, { ...point, accuracy: 0 });
  const distance = resultDistance(result, point);
  // Address hierarchy fields (town, city) come from administrative containment in OSM.
  // Accept the municipality when the result is within a generous radius (<= 2500 m)
  // or is a boundary polygon containing the point.
  const municipalityOrCity = candidateMunicipality && (distance <= 2500 || municipalityBoundary || barangayBoundary) ? candidateMunicipality : '';
  // Ordinary reverse results are usually roads/buildings, not boundaries. Use
  // their explicit address label when reasonably nearby (<= 500 m for rural barangays),
  // unambiguous in our PSGC records, and GPS uncertainty is bounded (or pin is manual).
  const boundedAccuracy = point.accuracy == null
    || (Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 100);
  const nearbyAddress = !administrative && distance <= 500 && boundedAccuracy;
  const barangay = municipalityOrCity && candidate && (barangayBoundary || nearbyAddress) ? candidate : '';
  const close = Boolean(municipalityOrCity) && distance <= 100;
  const street = close ? clean(address.road) || clean(address.pedestrian) : '';
  const landmark = close && ['amenity', 'tourism', 'shop', 'leisure', 'office', 'historic'].includes(result?.category) ? clean(result.name) : '';
  return {
    province: 'Pangasinan', municipalityOrCity, barangay, zipCode: getPangasinanZipCode(municipalityOrCity) || '', street,
    location: landmark || (street ? [clean(address.house_number), street].filter(Boolean).join(' ').slice(0, 255)
      : municipalityOrCity ? [barangay, municipalityOrCity, 'Pangasinan'].filter(Boolean).join(', ') : ''),
  };
}

function createProviderGeocoder({ fetchFn = (...args) => fetch(...args), now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  let nextRequestAt = 0, busy = false;
  const remember = (key, entry) => {
    cache.set(key, entry);
    // Remove expired data even if nobody requests that point again. The timer
    // captures only the cache key, not an evicted address/result object.
    setTimeout(() => { if (cache.get(key)?.until <= now()) cache.delete(key); }, entry.until - now()).unref();
  };
  return async (point) => {
    const { validateIncidentCoordinates } = await import('../../../shared/incidentProvince.mjs');
    if (validateIncidentCoordinates(point)) throw new Error('OUTSIDE_PANGASINAN');
    // Adjacent pins may resolve to different addresses, including across a
    // barangay boundary. Cache only an exact coordinate match.
    const key = `${point.latitude},${point.longitude}`;
    const cached = cache.get(key);
    if (cached?.until > now()) {
      if (cached.failed) throw new Error('GEOCODER_UNAVAILABLE');
      return resolveIncidentAddress(cached.data, point);
    }
    if (pending.has(key)) return resolveIncidentAddress(await pending.get(key), point);
    if (busy || now() < nextRequestAt) throw new Error('GEOCODER_BUSY');
    busy = true;
    nextRequestAt = now() + 1100;
    const request = Promise.resolve().then(async () => {
      try {
        // App-wide throttling for this single server process. For multiple replicas,
        // use a shared rate-limited proxy/provider rather than public Nominatim.
        // Policy: https://operations.osmfoundation.org/policies/nominatim/
        const endpoint = new URL(process.env.REVERSE_GEOCODING_URL || 'https://nominatim.openstreetmap.org/reverse');
        if (endpoint.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
        endpoint.search = new URLSearchParams({ format: 'jsonv2', lat: String(point.latitude), lon: String(point.longitude),
          zoom: '18', addressdetails: '1', layer: 'address', polygon_geojson: '1', extratags: '1', 'accept-language': 'en' });
        const response = await fetchFn(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'SafeLink-IncidentLocation/1.0' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
          if (response.status === 429) nextRequestAt = now() + 60000;
          throw new Error('GEOCODER_UNAVAILABLE');
        }
        const result = await response.json();
        if (!result?.address || typeof result.address !== 'object' || Array.isArray(result.address) || result.error) throw new Error('GEOCODER_UNAVAILABLE');
        resolveIncidentAddress(result, point); // Validate scope before caching provider data.
        // Short-lived, bounded memory only; never persist or log coordinates.
        cache.delete(key);
        remember(key, { data: result, until: now() + 10 * 60 * 1000 });
        return result;
      } catch (error) {
        if (error.message === 'OUTSIDE_PANGASINAN') throw error;
        remember(key, { failed: true, until: now() + 30000 });
        throw new Error('GEOCODER_UNAVAILABLE');
      } finally {
        busy = false;
        pending.delete(key);
        while (cache.size > 100) cache.delete(cache.keys().next().value);
      }
    });
    pending.set(key, request);
    return resolveIncidentAddress(await request, point);
  };
}

function createIncidentGeocoder(options) {
  const provider = createProviderGeocoder(options);
  return async (point) => {
    const { municipalitiesAt } = await import('../../../shared/incidentMunicipality.mjs');
    const candidates = municipalitiesAt(point);
    const localMunicipality = candidates.length === 1 ? candidates[0] : '';
    let address;
    try {
      address = await provider(point);
    } catch (error) {
      if (error.message === 'OUTSIDE_PANGASINAN') throw error;
      // When external provider fails (503, 429, timeout, network error),
      // fall back to verified local municipality geometry from GeoJSON.
      if (localMunicipality) {
        return {
          province: 'Pangasinan',
          municipalityOrCity: localMunicipality,
          barangay: '',
          street: '',
          zipCode: getPangasinanZipCode(localMunicipality) || '',
          location: `${localMunicipality}, Pangasinan`,
        };
      }
      throw error;
    }
    // If provider succeeded, but its municipality didn't match or was missing:
    // If we have verified local geometry, ensure municipality is populated!
    if (localMunicipality && (!address?.municipalityOrCity || address.municipalityOrCity !== localMunicipality)) {
      const municipalityBarangays = getMunicipality(localMunicipality)?.barangays.map((b) => b.name) || [];
      const validBarangay = municipalityBarangays.includes(address?.barangay) ? address.barangay : '';
      return {
        province: 'Pangasinan',
        municipalityOrCity: localMunicipality,
        barangay: validBarangay,
        street: address?.street || '',
        zipCode: getPangasinanZipCode(localMunicipality) || '',
        location: address?.location || `${localMunicipality}, Pangasinan`,
      };
    }
    return address;
  };
}

module.exports = { resolveIncidentAddress, createProviderGeocoder, createIncidentGeocoder, getIncidentAddress: createIncidentGeocoder() };
