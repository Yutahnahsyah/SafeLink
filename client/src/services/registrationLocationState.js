import { getPangasinanZipCode } from '../data/pangasinanLocations.js';

export function updateRegistrationValue(current, key, value, mode) {
  const next = { ...current, [key]: value };
  if (key === 'municipalityOrCity') next.zipCode = getPangasinanZipCode(value) || '';
  if (mode !== 'citizen') return next;
  if (key === 'municipalityOrCity' && value !== current.municipalityOrCity) {
    next.barangay = ''; next.street = ''; next.streetSuggestionContext = '';
  }
  if (key === 'barangay' && value !== current.barangay) {
    if (current.streetSuggestionContext) next.street = '';
    next.streetSuggestionContext = '';
  }
  if (key === 'street') next.streetSuggestionContext = '';
  return next;
}
export function filterStreetSuggestions(names, query) {
  const text = query.trim().toLocaleLowerCase();
  if (text.length < 2) return [];
  return names.filter((name) => name.toLocaleLowerCase().includes(text))
    .sort((a, b) => Number(b.toLocaleLowerCase().startsWith(text)) - Number(a.toLocaleLowerCase().startsWith(text)) || a.localeCompare(b)).slice(0, 8);
}
