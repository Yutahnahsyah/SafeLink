// Only operational metadata belongs in audit records. Never copy request bodies,
// credentials, contact details, evidence, or arbitrary nested objects.
const stringFields = [
  'reason', 'attemptedEmailHash', 'role', 'deletedRole', 'incidentType',
  'previousStatus', 'newStatus', 'previousSeverity', 'newSeverity',
  'citizenUrgency', 'officialSeverity', 'requestedAgency', 'assignedAgency',
  'previousAssignedAgency', 'newAssignedAgency',
  'previousAssignedPersonnel', 'newAssignedPersonnel',
  'previousMunicipality', 'newMunicipality', 'publicationReason', 'publicationStatus',
];

function safeDetails(details) {
  const safe = {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) return safe;
  for (const key of stringFields) {
    if (!Object.hasOwn(details, key)) continue;
    if (typeof details[key] === 'string') safe[key] = details[key].slice(0, 160);
    else if (details[key] === null) safe[key] = null;
  }
  for (const key of ['fileCount', 'cooldownSeconds']) {
    if (Object.hasOwn(details, key) && Number.isSafeInteger(details[key]) && details[key] >= 0) {
      safe[key] = details[key];
    }
  }
  if (Object.hasOwn(details, 'mimeTypes') && Array.isArray(details.mimeTypes)) {
    safe.mimeTypes = details.mimeTypes.filter(value => typeof value === 'string'
      && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value))
      .slice(0, 20).map(value => value.slice(0, 100));
  }
  return safe;
}

const reference = value => {
  if (value == null) return null;
  const id = value._id ?? value;
  const text = String(id);
  return /^[a-f\d]{24}$/i.test(text) ? text : null;
};
const displayText = value => typeof value === 'string' ? value.slice(0, 160) : null;

function publicEvent(event) {
  const actor = event.actor;
  const identity = actor && typeof actor === 'object' ? actor : {};
  const name = [identity.firstName, identity.lastName]
    .filter(value => typeof value === 'string' && value).join(' ');
  return {
    _id: reference(event._id),
    actorId: reference(actor),
    actorName: displayText(event.actorName) || displayText(name) || null,
    actorRole: displayText(event.actorRole) || displayText(identity.role),
    targetUser: reference(event.targetUser),
    incident: reference(event.incident),
    action: displayText(event.action),
    outcome: displayText(event.outcome),
    createdAt: event.createdAt,
    requestId: displayText(event.requestId),
    details: safeDetails(event.details),
  };
}

module.exports = { safeDetails, publicEvent };
