const { getMunicipality } = require('../utils/registrationLocations');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function buildStreetQuery(municipality, barangay) {
  const code = getMunicipality(municipality).code;
  const code9 = code.slice(0, 2) + code.slice(3);
  const baseName = municipality.replace(/ City$/, '');
  const names = [...new Set([municipality, baseName, `City of ${baseName}`, `Municipality of ${baseName}`])];
  const namePattern = JSON.stringify(`^(${names.map(escapeRegex).join('|')})$`);
  const barangayPattern = JSON.stringify(`^${escapeRegex(barangay)}$`);
  return `[out:json][timeout:6];area["ISO3166-2"="PH-PAN"]->.province;`
    + `(rel(area.province)["boundary"="administrative"]["admin_level"="6"]["ref:psgc"~"^(${code}|${code9})$"];`
    + `rel(area.province)["boundary"="administrative"]["admin_level"="6"]["name"~${namePattern},i];);map_to_area->.municipality;`
    + `rel(area.municipality)["boundary"="administrative"]["admin_level"="10"]["name"~${barangayPattern},i];map_to_area->.barangay;`
    + 'way(area.barangay)["highway"]["name"];out tags;';
}

function createStreetService({ fetchFn = (...args) => fetch(...args), now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let nextRequestAt = 0;
  let busy = false;
  return async (municipality, barangay) => {
    const key = `${municipality}\0${barangay}`;
    const cached = cache.get(key);
    if (cached && cached.until > now()) {
      if (cached.failed) throw new Error('STREET_SERVICE_UNAVAILABLE');
      return cached.data;
    }
    if (pending.has(key)) return pending.get(key);
    if (busy || now() < nextRequestAt) throw new Error('STREET_SERVICE_BUSY');
    busy = true;
    nextRequestAt = now() + 1500;
    const request = Promise.resolve().then(async () => {
      try {
        const endpoint = new URL(process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter');
        if (endpoint.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
        // Only public locality names/codes are sent; typed street text never leaves the browser here.
        endpoint.searchParams.set('data', buildStreetQuery(municipality, barangay));
        const response = await fetchFn(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'SafeLink-LocationSuggestions/1.0' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
        const payload = await response.json();
        if (payload.remark || !Array.isArray(payload.elements) || payload.elements.length > 10000) throw new Error('INCOMPLETE_RESPONSE');
        const data = [...new Set(payload.elements.filter((item) => item.type === 'way' && item.tags?.highway)
          .map((item) => item.tags?.name).filter((name) => typeof name === 'string' && name.length <= 255 && name.trim().length > 1 && !/[<>\p{Cc}\p{Cf}]/u.test(name)).map((name) => name.trim()))]
          .sort((a, b) => a.localeCompare(b)).slice(0, 500);
        cache.delete(key);
        cache.set(key, { data, until: now() + 24 * 60 * 60 * 1000 });
        return data;
      } catch {
        cache.set(key, { failed: true, until: now() + 30000 });
        throw new Error('STREET_SERVICE_UNAVAILABLE');
      } finally {
        pending.delete(key); busy = false;
        while (cache.size > 100) cache.delete(cache.keys().next().value);
      }
    });
    pending.set(key, request);
    return request;
  };
}
module.exports = { buildStreetQuery, createStreetService, getStreetNames: createStreetService() };
