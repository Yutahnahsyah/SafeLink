// Keep the full-resolution geographic reference out of the initial app bundle.
// Native module caching shares one load across GPS, map clicks and validation.
export const loadIncidentMunicipality = () => import('../../../shared/incidentMunicipality.mjs');
