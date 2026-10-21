// Formatting aliases only; never fuzzy-match a jurisdiction to a nearby name.
export function normalizeMunicipalityName(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\b(?:city|municipality)\s+of\s+/g, '')
    .replace(/\b(?:city|municipality|lgu|pangasinan)\b/g, '')
    .replace(/\bsta\.?\s+/g, 'santa ').replace(/\bsto\.?\s+/g, 'santo ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
