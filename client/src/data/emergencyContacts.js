const verifiedSource = "Official LGU emergency contact listing";
const lastVerified = "2026-09";

export const provincialEmergencyContacts = [
  {
    id: "national-911",
    agency: "911",
    type: "Immediate emergency",
    numbers: ["911"],
    description:
      "National emergency hotline for police, fire, rescue, and medical emergencies.",
    verified: true,
    source: "National emergency hotline",
    lastVerified,
  },
  {
    id: "pangasinan-pdrrmo",
    agency: "Pangasinan PDRRMO",
    type: "Disaster / Rescue",
    numbers: ["0918-934-5754", "0917-150-5754"],
    description:
      "Province-wide disaster risk reduction and emergency coordination.",
    verified: true,
    source: "Pangasinan PDRRMO listing",
    lastVerified,
  },
];

const localRecords = {
  alaminos: {
    location: "Alaminos City",
    contacts: [
      {
        agency: "Alaminos City CDRRMO",
        type: "Disaster / Rescue",
        numbers: [
          "(075) 632-1058",
          "(075) 523-2907",
          "0947-551-1420",
          "0977-707-6681",
        ],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  anda: {
    location: "Anda",
    contacts: [
      {
        agency: "Anda MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0961-200-9682", "0966-794-2555"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  bolinao: {
    location: "Bolinao",
    contacts: [
      {
        agency: "Bolinao MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0912-084-9571"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  calasiao: {
    location: "Calasiao",
    contacts: [
      {
        agency: "Calasiao MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0932-666-8199", "(075) 522-3924"],
        verified: true,
        source: verifiedSource,
        lastVerified,
      },
      {
        agency: "Calasiao Rural Health Unit I",
        type: "Health / Medical",
        numbers: ["(075) 529-3548"],
        facilityHead: "Jesus Arturo De Vera",
        address: "Provincial Road, Poblacion West, Calasiao, Pangasinan",
        verified: false,
        source: "Pending verification with the Calasiao LGU or health office",
      },
      {
        agency: "Calasiao Rural Health Unit II",
        type: "Health / Medical",
        numbers: ["(075) 529-6552"],
        facilityHead: "Ma. Christina Estrada",
        address: "Malasiqui-Calasiao Road, Calasiao, Pangasinan",
        verified: false,
        source: "Pending verification with the Calasiao LGU or health office",
      },
      {
        agency: "Calasiao Municipal Hall",
        type: "Health / Medical",
        numbers: ["(075) 529-2523"],
        description: "Health concerns",
        verified: false,
        source: "Pending verification with the Calasiao LGU or health office",
      },
    ],
  },
  dagupan: {
    location: "Dagupan City",
    contacts: [
      {
        agency: "Dagupan CDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0968-444-9598", "(075) 540-0363"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  lingayen: {
    location: "Lingayen",
    contacts: [
      {
        agency: "Lingayen LDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0919-099-2230", "(075) 653-7515"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  mangaldan: {
    location: "Mangaldan",
    contacts: [
      {
        agency: "Mangaldan MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["(075) 529-0218"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  mapandan: {
    location: "Mapandan",
    contacts: [
      {
        agency: "Mapandan MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0969-223-6912", "(075) 600-2564"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  pozorrubio: {
    location: "Pozorrubio",
    contacts: [
      {
        agency: "Pozorrubio MDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0919-094-4883", "(075) 632-7328"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  "san-manuel": {
    location: "San Manuel",
    contacts: [
      {
        agency: "San Manuel LDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0956-992-9421"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  "santa-maria": {
    location: "Santa Maria",
    contacts: [
      {
        agency: "Santa Maria LDRRMO",
        type: "Disaster / Rescue",
        numbers: ["0921-558-9033"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
  urdaneta: {
    location: "Urdaneta City",
    contacts: [
      {
        agency: "Urdaneta City Rescue",
        type: "Disaster / Rescue",
        numbers: ["0917-818-5374", "0917-159-1545"],
        source: verifiedSource,
        lastVerified,
      },
    ],
  },
};

const locationNames = [
  "Agno",
  "Aguilar",
  "Alaminos City",
  "Alcala",
  "Anda",
  "Asingan",
  "Balungao",
  "Bani",
  "Basista",
  "Bautista",
  "Bayambang",
  "Binalonan",
  "Binmaley",
  "Bolinao",
  "Bugallon",
  "Burgos",
  "Calasiao",
  "Dagupan City",
  "Dasol",
  "Infanta",
  "Labrador",
  "Laoac",
  "Lingayen",
  "Mabini",
  "Malasiqui",
  "Manaoag",
  "Mangaldan",
  "Mangatarem",
  "Mapandan",
  "Natividad",
  "Pozorrubio",
  "Rosales",
  "San Carlos City",
  "San Fabian",
  "San Jacinto",
  "San Manuel",
  "San Nicolas",
  "San Quintin",
  "Santa Barbara",
  "Santa Maria",
  "Santo Tomas",
  "Sison",
  "Sual",
  "Tayug",
  "Umingan",
  "Urbiztondo",
  "Urdaneta City",
  "Villasis",
];

export const emergencyContacts = Object.fromEntries(
  locationNames.map((location) => {
    const key = location
      .toLowerCase()
      .replace(/ city$/, "")
      .replace(/[^a-z]+/g, "-");
    const record = localRecords[key];
    return [
      key,
      {
        location,
        verified: Boolean(record),
        contacts: record?.contacts || [],
        fallback: "911",
      },
    ];
  }),
);

export const emergencyContactTypes = [
  "Disaster / Rescue",
  "Police",
  "Fire",
  "Health / Medical",
  "Social Welfare",
  "Red Cross",
];
