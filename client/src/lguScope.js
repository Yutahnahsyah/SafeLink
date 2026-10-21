import { normalizeMunicipalityName } from '../../shared/municipalityNames.mjs';

const AREA_FIELDS = [
  "assignedLgu",
  "assignedLGU",
  "assignedMunicipality",
  "assignedCity",
  "jurisdiction",
  "assignedArea",
  "assignedOffice",
  "municipality",
  "city",
  "lgu",
  "lguName",
  "office",
  "officeMunicipality",
  "targetLgu",
  "recipientLgu",
];

const USER_AREA_FIELDS = ["jurisdiction", "assignedArea", "municipality", "city"];

export function normalizeLguName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(city|municipality)\s+of\b/gi, " ")
    .replace(/\b(lgu|mdrrmo|cdrrmo|ldrrmo|disaster risk reduction(?: and management)? office|disaster response office)\b/gi, " ")
    .replace(/\b(municipal|office|personnel|public safety|emergency|disaster|risk|reduction|management|response)\b/gi, " ")
    .replace(/\bpangasinan\b/gi, " ")
    .replace(/\bcity\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function getLguJurisdiction(user) {
  if (!user) return "";
  if (user.jurisdiction?.municipalityOrCity) return user.jurisdiction.municipalityOrCity.trim();
  const explicit = USER_AREA_FIELDS.map((field) => user[field]).find((value) => normalizeLguName(value));
  if (explicit) return String(explicit).trim().replace(/\s+LGU$/i, "");

  const office = String(user.office || "").trim();
  if (!office || /unavailable/i.test(office)) return "";
  return office
    .replace(/\b(Municipality|City)\s+of\s+/i, "")
    .replace(/\b(LGU|MDRRMO|CDRRMO|LDRRMO)\b/gi, "")
    .replace(/,?\s*Pangasinan\b/i, "")
    .trim();
}

function directRecordArea(record) {
  if (!record || typeof record !== "object") return "";
  for (const field of AREA_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && normalizeLguName(value)) return value;
    if (value && typeof value === "object") {
      const nested = value.name || value.label || value.municipalityOrCity || value.municipality || value.city;
      if (normalizeLguName(nested)) return nested;
    }
  }
  return "";
}

export function getRecordJurisdiction(record) {
  const direct = directRecordArea(record);
  if (direct) return direct;

  // Only assignment-bearing nested records are trusted. Free-form location text
  // is intentionally not used as authorization metadata.
  for (const key of ["assignment", "incident", "report", "personnel", "recipient"]) {
    const nested = directRecordArea(record?.[key]);
    if (nested) return nested;
  }
  return "";
}

export function isRecordWithinJurisdiction(record, jurisdiction) {
  const expected = normalizeLguName(jurisdiction);
  const actual = normalizeLguName(getRecordJurisdiction(record));
  return Boolean(expected && actual && expected === actual);
}

export function scopeLguRecords(records, jurisdiction) {
  if (!Array.isArray(records)) return [];
  return records.filter((record) => isRecordWithinJurisdiction(record, jurisdiction));
}

export function scopeLguResult(result, jurisdiction, { detail = false } = {}) {
  if (!result || !result.available) return { ...result, jurisdiction };
  if (detail) {
    const allowed = isRecordWithinJurisdiction(result.data, jurisdiction);
    return { ...result, data: allowed ? result.data : null, jurisdiction, outOfScope: Boolean(result.data && !allowed) };
  }
  return { ...result, data: scopeLguRecords(result.data, jurisdiction), jurisdiction };
}

// The authenticated boundary endpoint selects the polygon from the shared
// 48-jurisdiction dataset. A missing/mismatched polygon is never a fallback map.
export function getLguMapView(jurisdiction, boundary) {
  const name = boundary?.properties?.safelinkName;
  if (!normalizeMunicipalityName(jurisdiction) || normalizeMunicipalityName(jurisdiction) !== normalizeMunicipalityName(name)
    || !['Polygon', 'MultiPolygon'].includes(boundary?.geometry?.type)) return null;
  return { label: name, boundary, immediate: true };
}

