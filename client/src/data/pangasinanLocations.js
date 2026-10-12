export const pangasinanLocations = [
  ["Agno", "municipality", "2408"], ["Aguilar", "municipality", "2415"], ["Alaminos City", "city", "2404"], ["Alcala", "municipality", "2425"],
  ["Anda", "municipality", "2405"], ["Asingan", "municipality", "2439"], ["Balungao", "municipality", "2442"], ["Bani", "municipality", "2407"],
  ["Basista", "municipality", "2422"], ["Bautista", "municipality", "2424"], ["Bayambang", "municipality", "2423"], ["Binalonan", "municipality", "2436"],
  ["Binmaley", "municipality", "2417"], ["Bolinao", "municipality", "2406"], ["Bugallon", "municipality", "2416"], ["Burgos", "municipality", "2410"],
  ["Calasiao", "municipality", "2418"], ["Dagupan City", "city", "2400"], ["Dasol", "municipality", "2411"], ["Infanta", "municipality", "2412"],
  ["Labrador", "municipality", "2402"], ["Laoac", "municipality", "2421"], ["Lingayen", "municipality", "2401"], ["Mabini", "municipality", "2409"],
  ["Malasiqui", "municipality", "2421"], ["Manaoag", "municipality", "2430"], ["Mangaldan", "municipality", "2432"], ["Mangatarem", "municipality", "2413"],
  ["Mapandan", "municipality", "2429"], ["Natividad", "municipality", "2446"], ["Pozorrubio", "municipality", "2435"], ["Rosales", "municipality", "2441"],
  ["San Carlos City", "city", "2420"], ["San Fabian", "municipality", "2433"], ["San Jacinto", "municipality", "2431"], ["San Manuel", "municipality", "2438"],
  ["San Nicolas", "municipality", "2447"], ["San Quintin", "municipality", "2444"], ["Santa Barbara", "municipality", "2419"], ["Santa Maria", "municipality", "2440"],
  ["Santo Tomas", "municipality", "2426"], ["Sison", "municipality", "2434"], ["Sual", "municipality", "2403"], ["Tayug", "municipality", "2445"],
  ["Umingan", "municipality", "2443"], ["Urbiztondo", "municipality", "2414"], ["Urdaneta City", "city", "2428"], ["Villasis", "municipality", "2427"],
].map(([name, type, zipCode]) => Object.freeze({ name, type, zipCode }));

export function getPangasinanZipCode(municipalityOrCity) {
  const normalized = municipalityOrCity.trim().toLowerCase();
  return pangasinanLocations.find(({ name }) => name.toLowerCase() === normalized)?.zipCode || "";
}
