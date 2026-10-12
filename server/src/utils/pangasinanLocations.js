const PANGASINAN_LOCATIONS = Object.freeze([
  ['Agno', '2408'], ['Aguilar', '2415'], ['Alaminos City', '2404'], ['Alcala', '2425'],
  ['Anda', '2405'], ['Asingan', '2439'], ['Balungao', '2442'], ['Bani', '2407'],
  ['Basista', '2422'], ['Bautista', '2424'], ['Bayambang', '2423'], ['Binalonan', '2436'],
  ['Binmaley', '2417'], ['Bolinao', '2406'], ['Bugallon', '2416'], ['Burgos', '2410'],
  ['Calasiao', '2418'], ['Dagupan City', '2400'], ['Dasol', '2411'], ['Infanta', '2412'],
  ['Labrador', '2402'], ['Laoac', '2421'], ['Lingayen', '2401'], ['Mabini', '2409'],
  ['Malasiqui', '2421'], ['Manaoag', '2430'], ['Mangaldan', '2432'], ['Mangatarem', '2413'],
  ['Mapandan', '2429'], ['Natividad', '2446'], ['Pozorrubio', '2435'], ['Rosales', '2441'],
  ['San Carlos City', '2420'], ['San Fabian', '2433'], ['San Jacinto', '2431'], ['San Manuel', '2438'],
  ['San Nicolas', '2447'], ['San Quintin', '2444'], ['Santa Barbara', '2419'], ['Santa Maria', '2440'],
  ['Santo Tomas', '2426'], ['Sison', '2434'], ['Sual', '2403'], ['Tayug', '2445'],
  ['Umingan', '2443'], ['Urbiztondo', '2414'], ['Urdaneta City', '2428'], ['Villasis', '2427']
].map(([municipalityOrCity, zipCode]) => Object.freeze({ municipalityOrCity, zipCode })));

const normalizeMunicipality = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const ZIP_BY_MUNICIPALITY = new Map(PANGASINAN_LOCATIONS.map(({ municipalityOrCity, zipCode }) => [
  normalizeMunicipality(municipalityOrCity),
  zipCode
]));

const getPangasinanZipCode = (municipalityOrCity) => (
  ZIP_BY_MUNICIPALITY.get(normalizeMunicipality(municipalityOrCity)) || null
);

module.exports = { PANGASINAN_LOCATIONS, getPangasinanZipCode };
