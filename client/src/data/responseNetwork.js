export const responseNetwork = [
  {
    id: "dagupan",
    name: "Dagupan City",
    lat: 16.0433,
    lng: 120.3333,
    type: "LGU Safety Office",
    category: "lgu",
    role: "Coordinates and monitors verified community reports.",
  },
  {
    id: "calasiao",
    name: "Calasiao",
    lat: 16.0111,
    lng: 120.36,
    type: "Barangay Office",
    category: "barangay",
    role: "Reviews local report details before coordination.",
  },
  {
    id: "lingayen",
    name: "Lingayen",
    lat: 16.0218,
    lng: 120.2319,
    type: "Disaster Response Office",
    category: "disaster",
    role: "Coordinates emergency resources and response readiness.",
  },
  {
    id: "urdaneta",
    name: "Urdaneta City",
    lat: 15.9761,
    lng: 120.5711,
    type: "Police Partner Agency",
    category: "police",
    role: "Receives verified referrals that require public-safety action.",
  },
  {
    id: "san-carlos",
    name: "San Carlos City",
    lat: 15.9287,
    lng: 120.3489,
    type: "Pangasinan Community Network",
    category: "community",
    role: "Connects residents to the centralized reporting workflow.",
  },
  {
    id: "alaminos",
    name: "Alaminos City",
    lat: 16.1554,
    lng: 119.9801,
    type: "Pangasinan Community Network",
    category: "community",
    role: "Connects residents to local verification and response channels.",
  },
];

export const responseNetworkLegend = [
  { category: "community", label: "Community Network" },
  { category: "barangay", label: "Barangay Office" },
  { category: "lgu", label: "LGU Safety Office" },
  { category: "police", label: "Police Partner Agency" },
  { category: "disaster", label: "Disaster Response Office" },
];

export const pangasinanMapBounds = [
  [15.68, 119.7],
  [16.52, 120.95],
];

export const pangasinanPanBounds = [
  [15.45, 119.35],
  [16.78, 121.3],
];
