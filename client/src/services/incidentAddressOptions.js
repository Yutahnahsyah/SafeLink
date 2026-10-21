import { pangasinanLocations } from '../data/pangasinanLocations.js';
const key = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const municipalityKey = (value) => key(value).replace(/^(city|municipality) of /, '').replace(/ (city|municipality)$/, '');
const barangayKey = (value) => key(value).replace(/^(barangay|brgy) /, '');
// Never invent options or fuzzy-match similarly named barangays.
function match(value, options, normalize) {
  if (!value) return null;
  const exact = options.find((option) => option.name === value);
  if (exact) return exact;
  const matches = options.filter((option) => normalize(option.name) === normalize(value));
  return matches.length === 1 ? matches[0] : null;
}
export const matchMunicipality = (value) => match(value, pangasinanLocations, municipalityKey);
export const matchBarangay = (value, options) => match(value, options, barangayKey);
