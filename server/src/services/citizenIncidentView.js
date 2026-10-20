const pick = (value, fields) => Object.fromEntries(fields.filter((field) => value?.[field] !== undefined).map((field) => [field, value[field]]));
// Staff remarks entered through the existing response form are citizen-visible.
// Administrative event remarks and explicitly private legacy entries are not.
const publicNotes = new Set(['submitted', 'status_changed', 'severity_changed', 'priority_confirmed',
  'barangay_handling_confirmed', 'note_added', 'closure_confirmation_requested', 'closure_confirmed']);
const administrativeUpdates = {
  escalation_requested: 'Barangay requested additional agency coordination.',
  agency_referred: 'The report was referred to the responsible agency.',
  agency_unassigned: 'The agency assignment was updated.',
  personnel_assigned: 'Authorized response personnel were assigned.',
  personnel_reassigned: 'The response personnel assignment was updated.',
};
function citizenIncidentView(document) {
  const incident = document.toObject ? document.toObject() : document;
  const result = pick(incident, ['_id', 'incidentType', 'description', 'citizenUrgency', 'severity', 'status',
    'priorityConfirmedAt', 'assignedAgency', 'createdAt', 'updatedAt']);
  result.agency = incident.assignedAgency;
  result.location = { ...pick(incident.location, ['latitude', 'longitude']),
    address: pick(incident.location?.address, ['street', 'landmark', 'barangay', 'municipalityOrCity', 'zipCode']) };
  result.evidenceFiles = (incident.evidenceFiles || []).map((file) => pick(file, ['_id', 'originalName', 'mimeType', 'size']));
  result.responseHistory = (incident.responseHistory || []).filter((entry) => entry.visibility !== 'internal'
    && entry.citizenVisible !== false && entry.isInternal !== true
    && (publicNotes.has(entry.eventType) || Object.hasOwn(administrativeUpdates, entry.eventType))).map((entry) => ({
    ...pick(entry, ['_id', 'eventType', 'status', 'newStatus', 'timestamp']),
    notes: administrativeUpdates[entry.eventType] || entry.notes,
  }));
  return result;
}
module.exports = { citizenIncidentView };
