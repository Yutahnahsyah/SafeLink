export const barangayQueues = ['All', 'Needs Review', 'In Progress', 'Referred', 'Resolved'];
export function barangayIncidentBucket(report) {
  if (['Resolved', 'Closed'].includes(report.status)) return 'Resolved';
  if (report.barangaySupport || ['LGU', 'Police'].includes(report.assignedAgency) || report.escalation?.requestedAt) return 'Referred';
  if (['Submitted', 'Under Barangay Review', 'Under Validation'].includes(report.status)) return 'Needs Review';
  if (['Verified', 'In Progress'].includes(report.status)) return 'In Progress';
  return 'All';
}
const samePlace = (a, b) => typeof a === 'string' && typeof b === 'string' && Boolean(a.trim()) && a.trim().toLowerCase() === b.trim().toLowerCase();
// UI guidance only. The process endpoint independently enforces all permissions.
export function barangayActions(report, user) {
  if (user?.role !== 'barangay_personnel' || !samePlace(report.barangay, user.jurisdiction?.barangay)
    || !samePlace(report.municipality, user.jurisdiction?.municipalityOrCity)) return [];
  if (['Closed', 'Rejected'].includes(report.status)) return [];
  const supporting = report.barangaySupport;
  if (!supporting && report.assignedAgency !== 'Barangay') return [];
  if (!supporting && report.assignedPersonnelId && report.assignedPersonnelId !== user.id) return [];
  if (report.status === 'Resolved') return report.closureConfirmation?.confirmedAt ? [] : ['close'];
  if (supporting) return ['note'];
  if (!report.assignedPersonnelId) return ['claim'];
  if (report.escalation?.requestedAt && !report.escalation?.acknowledgedAt) return ['note'];
  if (report.status === 'Submitted') return ['beginReview', 'note'];
  if (['Under Barangay Review', 'Under Validation'].includes(report.status)) return ['review', 'reject', 'note'];
  if (!report.priorityConfirmed) return ['priority', 'note'];
  if (report.status === 'Verified') return ['start', 'refer', 'note'];
  if (report.status === 'In Progress') return ['resolve', 'refer', 'note'];
  return [];
}

// Attention is derived from the same action guidance used by incident details.
export function barangayAttention(report, user) {
  const actions = barangayActions(report, user);
  const reasons = { claim: 'Awaiting responsibility acceptance', beginReview: 'Awaiting review', review: 'Review and priority confirmation needed',
    priority: 'Awaiting official priority', start: 'Ready for local response', resolve: 'Response in progress', close: 'Awaiting closure confirmation' };
  const action = actions.find((value) => reasons[value]);
  return action ? reasons[action] : '';
}

export function barangayRecentActivity(reports) {
  const statusLabels = { Verified: 'Incident verified', 'In Progress': 'Response started', Resolved: 'Resolution submitted', Closed: 'Incident closed', Rejected: 'Report rejected' };
  const eventLabels = { submitted: 'Report submitted', escalation_requested: 'Referral requested', escalation_acknowledged: 'Referral acknowledged', agency_referred: 'Incident referred',
    barangay_handling_confirmed: 'Barangay handling confirmed', closure_confirmed: 'Incident closed', priority_confirmed: 'Official priority confirmed' };
  return reports.flatMap((report) => (report.responseHistory || []).flatMap((entry, index) => {
    if (entry.eventType === 'status_changed' && (entry.newStatus || entry.status) === 'Closed'
      && report.responseHistory.some((event) => event.eventType === 'closure_confirmed')) return [];
    const label = eventLabels[entry.eventType] || (entry.eventType === 'status_changed' ? statusLabels[entry.newStatus || entry.status] : '');
    const date = new Date(entry.timestamp);
    return label && Number.isFinite(date.getTime()) ? [{ id: `${report.id}-${index}`, reportId: report.id, type: report.type, label, timestamp: date.toISOString() }] : [];
  })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
