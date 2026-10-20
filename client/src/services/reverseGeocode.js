import { apiRequest } from './apiClient.js';

// The server owns provider configuration, application-wide throttling and matching.
// POST keeps precise coordinates out of browser/server URL logs.
export async function reverseGeocode({ latitude, longitude, accuracy, signal }) {
  const result = await apiRequest('locations/incident-address', {
    method: 'POST', body: { latitude, longitude, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}) }, signal,
  });
  const fields = ['municipalityOrCity', 'barangay', 'zipCode', 'street', 'location'];
  if (!result?.data || !fields.every((field) => typeof result.data[field] === 'string')) throw new Error('ADDRESS_NOT_FOUND');
  return Object.fromEntries(fields.map((field) => [field, result.data[field]]));
}
