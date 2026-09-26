const DEFAULT_REVERSE_GEOCODER = "https://nominatim.openstreetmap.org/reverse";
const reverseGeocoderUrl = import.meta.env.VITE_REVERSE_GEOCODING_URL || DEFAULT_REVERSE_GEOCODER;
const cache = new Map();
let lastRequestStartedAt = 0;

const wait = (duration, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
  const timer = window.setTimeout(resolve, duration);
  signal?.addEventListener("abort", () => {
    window.clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  }, { once: true });
});

const clean = (value) => typeof value === "string" ? value.trim() : "";
const first = (...values) => values.map(clean).find(Boolean) || "";

function uniqueParts(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const normalized = clean(part).toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function formatPhilippineAddress(result) {
  const address = result?.address || {};
  const namedLandmark = ["amenity", "tourism", "shop", "leisure", "office", "historic"].includes(result?.category)
    ? clean(result.name)
    : "";
  const road = first(address.road, address.pedestrian, address.path, address.footway);
  const street = road ? first(address.house_number && `${address.house_number} ${road}`, road) : namedLandmark;
  const barangay = first(address.village, address.suburb, address.neighbourhood, address.quarter, address.hamlet, address.city_district, address.district);
  const municipality = first(address.city, address.town, address.municipality);
  const provinceCandidates = [address.province, address.state, address.county].map(clean).filter(Boolean);
  const pangasinan = provinceCandidates.find((part) => /pangasinan/i.test(part));
  const province = pangasinan ? "Pangasinan" : first(address.province, address.county, address.state);
  const structured = uniqueParts([street, barangay, municipality, province]);
  if (structured.length >= 2) return structured.join(", ");

  const fallback = uniqueParts((result?.display_name || "").split(",").map((part) => part.trim()).filter((part) =>
    part &&
    !/^philippines$/i.test(part) &&
    !/^ilocos region$/i.test(part) &&
    !/^region i$/i.test(part) &&
    !/^\d{4,6}$/.test(part)
  )).slice(0, 4);
  return fallback.join(", ");
}

export async function reverseGeocode({ latitude, longitude, signal }) {
  const cacheKey = `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const throttleDelay = Math.max(0, 1000 - (Date.now() - lastRequestStartedAt));
  if (throttleDelay) await wait(throttleDelay, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const url = new URL(reverseGeocoderUrl);
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
    layer: "address",
    "accept-language": "en",
  });
  lastRequestStartedAt = Date.now();
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (!response.ok) throw new Error("REVERSE_GEOCODING_UNAVAILABLE");

  const result = await response.json();
  const locationText = formatPhilippineAddress(result);
  if (!locationText) throw new Error("ADDRESS_NOT_FOUND");
  cache.set(cacheKey, locationText);
  return locationText;
}
