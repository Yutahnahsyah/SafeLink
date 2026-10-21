import { apiRequest } from './apiClient.js';

import { matchMunicipality, matchBarangay } from './incidentAddressOptions.js';
import { loadIncidentMunicipality } from './incidentMunicipality.js';

// The server owns provider configuration, application-wide throttling and matching.
// POST keeps precise coordinates out of browser/server URL logs.
export async function reverseGeocode({ latitude, longitude, accuracy, signal, onMunicipality }) {
  const { municipalitiesAt } = await loadIncidentMunicipality();
  if (signal?.aborted) throw new DOMException('Address lookup cancelled', 'AbortError');
  const candidates = municipalitiesAt({ latitude, longitude });
  const local = candidates.length === 1 ? matchMunicipality(candidates[0]) : null;
  const fallback = local ? { province: 'Pangasinan', municipalityOrCity: local.name, zipCode: local.zipCode,
    barangay: '', street: '', location: `${local.name}, Pangasinan`,
    warning: 'Municipality resolved from local boundaries. Confirm the barangay and add any known street or landmark manually.' } : null;
  if (local) onMunicipality?.(local.name, local.zipCode);
  let result;
  try {
    result = await apiRequest('locations/incident-address', {
      method: 'POST', body: { latitude, longitude, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}) }, signal,
    });
  } catch (error) {
    if (error.name === 'AbortError' || !fallback || [401, 403].includes(error.status)) throw error;
    return fallback;
  }
  const fields = ['province', 'municipalityOrCity', 'barangay', 'zipCode', 'street', 'location'];
  if (!result?.data || result.data.province !== 'Pangasinan'
    || !fields.every((field) => result.data[field] == null || typeof result.data[field] === 'string')
    || !fields.some((field) => field !== 'province' && result.data[field]?.trim())) {
    if (fallback) return fallback;
    throw new Error('ADDRESS_NOT_FOUND');
  }
  const address = Object.fromEntries(fields.map((field) => [field, result.data[field]?.trim() || '']));
  const providerMunicipality = matchMunicipality(address.municipalityOrCity);
  if (local && providerMunicipality?.name !== local.name) return fallback;
  const municipality = local || (candidates.length && !candidates.includes(providerMunicipality?.name) ? null : providerMunicipality);
  if (!municipality) return { ...address, municipalityOrCity: '', barangay: '', zipCode: '',
    warning: 'The detected municipality could not be matched to the available choices. Select the municipality and barangay manually.' };
  address.municipalityOrCity = municipality.name;
  address.zipCode = municipality.zipCode;
  if (!local) onMunicipality?.(municipality.name, municipality.zipCode);
  if (address.barangay) {
    try {
      const options = await apiRequest(`locations/barangays?municipality=${encodeURIComponent(municipality.name)}`, { auth: false, signal });
      const barangay = matchBarangay(address.barangay, Array.isArray(options?.data) ? options.data : []);
      address.barangay = barangay?.name || '';
      if (!barangay) address.warning = 'The detected barangay does not match the choices for this municipality. Select it manually.';
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      address.barangay = '';
      address.warning = 'Barangay choices could not be verified. Retry or confirm the barangay manually.';
    }
  }
  return address;
}
