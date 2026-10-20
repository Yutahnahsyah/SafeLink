const snapshot = require('../data/pangasinanBarangays.json');
const { PANGASINAN_LOCATIONS } = require('./pangasinanLocations');
const municipalityNames = new Set(PANGASINAN_LOCATIONS.map((item) => item.municipalityOrCity));
const getMunicipality = (value) => typeof value === 'string' && municipalityNames.has(value) ? snapshot.municipalities[value] : null;
const getBarangay = (municipality, value) => typeof value === 'string' ? getMunicipality(municipality)?.barangays.find((item) => item.name === value.trim()) || null : null;
const validStreet = (value) => typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 255
  && /[\p{L}\p{N}]/u.test(value) && !/[<>\p{Cc}\p{Cf}]/u.test(value);
module.exports = { getMunicipality, getBarangay, validStreet, snapshot };
