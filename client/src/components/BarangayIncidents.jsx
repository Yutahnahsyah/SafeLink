import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '../routing';
import { incidentApi } from '../services/safelinkApi';
import { barangayActions, barangayIncidentBucket, barangayQueues, barangayAttention, barangayRecentActivity } from '../services/barangayIncidents';
import ProtectedEvidence from './ProtectedEvidence';
import SafeLinkMap from './maps/SafeLinkMap';
import { SectionSkeleton } from './PageSkeletons';
import './BarangayIncidents.css';

const labels = { claim: 'Accept responsibility', beginReview: 'Begin review', review: 'Complete review', priority: 'Confirm official priority',
  start: 'Begin response', note: 'Add response note', refer: 'Request LGU / Police coordination', resolve: 'Resolve incident', close: 'Confirm resolution and close', reject: 'Reject report' };
const hasLocalDecision = (report) => report.statusHistory?.some((entry) => entry.eventType === 'barangay_handling_confirmed');
const actionLabel = (action, report) => action === 'start' && !hasLocalDecision(report) ? 'Handle at Barangay Level' : labels[action];
const detailLink = (id) => `/barangay/incidents/${encodeURIComponent(id)}`;
const statusClass = (status) => `citizen-status status-${status.toLowerCase().replaceAll(' ', '-')}`;

function ActionDialog({ action, report, user, onClose, onUpdated }) {
  const dialog = useRef(null), submitting = useRef(false);
  const [priority, setPriority] = useState(report.priority || 'Medium');
  const [path, setPath] = useState(action === 'refer' ? 'LGU' : '');
  const [remarks, setRemarks] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requiredRemarks = ['note', 'refer', 'resolve', 'reject', 'close', 'review'].includes(action);
  useEffect(() => { dialog.current.showModal(); }, []);
  const close = () => { dialog.current.close(); onClose(); };
  const submit = async (event) => {
    event.preventDefault(); if (submitting.current) return;
    const note = remarks.trim();
    if (action === 'review' && !path) { setError('Choose Barangay handling or request LGU / Police coordination.'); return; }
    if (requiredRemarks && !note) { setError('Enter remarks describing this action.'); return; }
    const payload = {
      claim: { assignedPersonnel: user.id, ...(report.status === 'Submitted' ? { status: 'Under Barangay Review' } : {}) },
      beginReview: { status: 'Under Barangay Review' }, review: { status: 'Verified', severity: priority, ...(path === 'local' ? { handlingDecision: 'Barangay' } : { escalationAgency: path }) },
      priority: { severity: priority }, start: { status: 'In Progress', ...(!hasLocalDecision(report) ? { handlingDecision: 'Barangay' } : {}) }, note: {}, refer: { escalationAgency: path },
      resolve: { status: 'Resolved' }, close: { closureConfirmed: true }, reject: { status: 'Rejected' },
    }[action];
    submitting.current = true; setBusy(true); setError('');
    try { const updated = await incidentApi.process(report.id, { ...payload, ...(note ? { remarks: note } : {}) }); onUpdated(updated); close(); }
    catch (err) { setError(err?.message || 'The action could not be saved. Refresh the incident and try again.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <dialog className="barangay-action-dialog" ref={dialog} aria-labelledby="barangay-action-title" onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
    <form onSubmit={submit} aria-busy={busy}>
      <h2 id="barangay-action-title">{actionLabel(action, report)}</h2>
      <p>{action === 'resolve' ? 'Describe the response and outcome. The report will be marked Resolved and will still require Barangay confirmation for final closure.'
        : action === 'refer' ? 'LGU must acknowledge and assign the verified report. A Police request is coordinated through the LGU.'
          : action === 'review' ? 'Confirm the official priority after reviewing the report and evidence, then explicitly choose local handling or coordination. Citizen-suggested urgency remains unchanged.'
            : action === 'start' ? 'Accept local Barangay handling and begin responding to this verified incident. The decision and response status are recorded in history and audit logs.'
            : 'Confirm this action for the selected incident. Response remarks appear in citizen-visible history.'}</p>
      <fieldset disabled={busy}>
        {['review', 'priority'].includes(action) && <label>Official priority<select value={priority} onChange={(event) => setPriority(event.target.value)}>{['Low', 'Medium', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}</select></label>}
        {['review', 'refer'].includes(action) && <label>Response decision<select required value={path} onChange={(event) => setPath(event.target.value)}>{action === 'review' && <><option value="">Choose how this incident will be handled</option><option value="local">Handle at Barangay Level</option></>}<option value="LGU">Request LGU intervention</option><option value="Police">Request Police coordination via LGU</option></select></label>}
        <label>{action === 'resolve' ? 'Resolution remarks' : 'Response remarks'}{requiredRemarks ? ' (required)' : ' (optional)'}<textarea autoFocus required={requiredRemarks} maxLength={2000} rows={5} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="barangay-action-buttons"><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Confirm action'}</button></div>
    </form>
  </dialog>;
}

function IncidentCard({ report, attention }) {
  return <article className="barangay-incident-card"><div className="barangay-incident-heading"><h3><Link to={detailLink(report.id)}>{report.type}</Link></h3><span className={statusClass(report.status)}>{report.status}</span></div>
    <p>{[report.barangay, report.municipality].filter(Boolean).join(', ') || 'Location unavailable'}</p>{attention && <p className="barangay-attention-reason">{attention}</p>}
    <dl><div><dt>Citizen-suggested urgency</dt><dd>{report.citizenUrgency || 'Not recorded'}</dd></div><div><dt>Official priority</dt><dd>{report.priorityConfirmed ? report.priority : 'Awaiting confirmation'}</dd></div></dl>
    <p className="barangay-incident-meta">{report.submittedAt} · {report.barangaySupport ? `Supporting ${report.assignedAgency} response` : report.escalation?.requestedAt && !report.escalation?.acknowledgedAt ? 'Awaiting LGU acknowledgment' : `${report.assignedAgency} handling`}</p>
    <Link className="barangay-incident-link" to={detailLink(report.id)}>View details →</Link>
  </article>;
}

function IncidentDetails({ report, user, onUpdated }) {
  const [action, setAction] = useState(null);
  const actions = barangayActions(report, user);
  const referred = report.barangaySupport || report.escalation?.requestedAt;
  return <div className="barangay-incident-details">
    <Link className="barangay-incident-link" to="/barangay/incidents">← Back to My Incidents</Link>
    <section className="barangay-incident-panel"><div className="barangay-incident-heading"><h2>{report.type}</h2><span className={statusClass(report.status)}>{report.status}</span></div>
      <dl className="barangay-detail-fields">{[['Reference', report.id], ['Location', report.location], ['Submitted', report.submittedAt], ['Citizen-suggested urgency', report.citizenUrgency || 'Not recorded'],
        ['Official priority', report.priorityConfirmed ? `${report.priority} — confirmed by Barangay` : 'Awaiting Barangay confirmation'], ['Handling agency', report.assignedAgency],
        ['Responsible personnel', report.assignedTo || (report.assignedPersonnelId ? 'Assigned personnel' : 'Unclaimed')]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not available'}</dd></div>)}</dl>
      <h3>Report description</h3><p className="barangay-report-description">{report.description}</p>
    </section>
    <section className="barangay-incident-panel"><h2>Permitted actions</h2>
      {hasLocalDecision(report) && !referred && <p>Handling decision: <strong>Handle at Barangay Level</strong>. Review and official priority confirmation are recorded in the response history.</p>}
      {referred && <p>{report.barangaySupport ? `This report is handled by ${report.assignedAgency}. Barangay can add supporting notes and confirm final closure after resolution.`
        : `A ${report.escalation.agency} coordination request is awaiting LGU acknowledgment. Local response changes are paused; supporting notes remain available.`}</p>}
      {report.escalation?.reason && <p><strong>Coordination reason:</strong> {report.escalation.reason}</p>}
      {report.escalation?.acknowledgedAt && <p>LGU acknowledgment recorded. Assignment and response remain with the designated agency.</p>}
      <div className="barangay-action-buttons">{actions.map((value) => <button type="button" key={value} onClick={() => setAction(value)}>{actionLabel(value, report)}</button>)}</div>
      {!actions.length && <p>No further actions are available to this account for the current status.</p>}
    </section>
    {['Resolved', 'Closed'].includes(report.status) && <section className="barangay-incident-panel"><h2>Resolution outcome</h2><p className="barangay-report-description">{report.resolution?.message || 'No resolution remarks were recorded for this older report.'}</p>{report.resolution?.timestamp && <time>{report.resolution.timestamp}</time>}</section>}
    <div className="barangay-detail-grid"><section className="barangay-incident-panel"><h2>Evidence</h2><div className="barangay-incident-evidence">{report.evidence?.length ? report.evidence.map((item) => <figure key={item.id}><ProtectedEvidence incidentId={report.id} item={item} /><figcaption>{item.name}</figcaption></figure>) : <p>No evidence files attached.</p>}</div></section>
      <section className="barangay-incident-panel"><h2>Incident location</h2><p>{report.location}</p>{report.coords?.every(Number.isFinite) && <><p>Latitude {report.latitude} · Longitude {report.longitude}</p><div className="barangay-detail-map"><SafeLinkMap mode="incidents" items={[report]} focusView={{ center: [report.latitude, report.longitude], zoom: 16 }} /></div></>}</section></div>
    <section className="barangay-incident-panel"><h2>Complete response history</h2><ol className="barangay-response-history">{report.statusHistory?.map((entry, index) => <li key={entry.id || index}><strong>{entry.eventType?.replaceAll('_', ' ') || entry.status}</strong><span>{entry.status}</span><time>{entry.timestamp || 'Time not recorded'}</time><p>{entry.message}</p></li>)}</ol>{!report.statusHistory?.length && <p>No response updates recorded.</p>}</section>
    {action && <ActionDialog action={action} report={report} user={user} onClose={() => setAction(null)} onUpdated={onUpdated} />}
  </div>;
}

export default function BarangayIncidents({ view, id, result, user, notifications }) {
  const { search } = useRouter();
  const [queue, setQueue] = useState(() => {
    const value = new URLSearchParams(search).get('queue'); return barangayQueues.includes(value) ? value : 'All';
  }), [query, setQuery] = useState(''), [updated, setUpdated] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { setUpdated(null); }, [result.data]);
  useEffect(() => { const value = new URLSearchParams(search).get('queue'); setQueue(barangayQueues.includes(value) ? value : 'All'); }, [search]);
  if (result.status === 'loading') return <SectionSkeleton variant="list" label="Loading Barangay incident queue" />;
  if (result.status === 'error') return <section className="barangay-incident-panel" role="alert"><p>{result.error?.message || 'Incidents could not be loaded.'}</p><button onClick={result.retry}>Retry loading incidents</button></section>;
  const reports = (result.data || []).map((item) => updated?.id === item.id ? updated : item);
  if (view === 'details') {
    const report = reports.find((item) => item.id === id);
    if (!report) return <section className="barangay-incident-panel"><h2>Incident unavailable</h2><p>This incident is unavailable to your account. It may have been reassigned or may be outside your jurisdiction.</p><Link to="/barangay/incidents">Return to My Incidents</Link></section>;
    return <>{message && <p role="status">{message}</p>}<IncidentDetails report={report} user={user} onUpdated={(item) => { setUpdated(item); setMessage('Incident updated successfully.'); result.retry(); notifications.retry(); }} /></>;
  }
  const counts = Object.fromEntries(barangayQueues.map((name) => [name, name === 'All' ? reports.length : reports.filter((item) => barangayIncidentBucket(item) === name).length]));
  const filtered = reports.filter((item) => (queue === 'All' || barangayIncidentBucket(item) === queue) && `${item.id} ${item.type} ${item.location}`.toLowerCase().includes(query.trim().toLowerCase()));
  const actionable = reports.filter((item) => barangayAttention(item, user)).sort((a, b) => {
    const priority = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return (b.priorityConfirmed ? priority[b.priority] || 0 : 0) - (a.priorityConfirmed ? priority[a.priority] || 0 : 0)
      || new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
  const activity = barangayRecentActivity(reports).slice(0, 6);
  const queueLabel = (name) => name === 'Resolved' ? 'Resolved / Closed' : name === 'All' ? 'Total reports' : name;
  return <div className="barangay-management">
    <nav className="barangay-queue-filters" aria-label="Incident queues">{barangayQueues.map((name) => view === 'dashboard'
      ? <Link key={name} to={`/barangay/incidents?queue=${encodeURIComponent(name)}`}><span>{queueLabel(name)}</span><strong>{counts[name]}</strong></Link>
      : <button type="button" key={name} aria-pressed={queue === name} onClick={() => setQueue(name)}>{queueLabel(name)} <strong>{counts[name]}</strong></button>)}</nav>
    <p className="barangay-scope-note">Your accessible reports, including supporting assignments. Each report belongs to one queue; resolved totals include closed reports. Rejected reports remain in Total reports.</p>
    {view === 'dashboard' ? <div className="barangay-management-grid"><div><section className="barangay-incident-panel" aria-labelledby="attention-heading"><div className="barangay-section-heading"><h2 id="attention-heading">Requires attention</h2><span>{actionable.length} reports</span></div><p>Prioritized by confirmed official priority, then oldest report. Resolved reports appear here only when your closure confirmation is still needed.</p>{actionable.slice(0, 5).map((report) => <IncidentCard key={report.id} report={report} attention={barangayAttention(report, user)} />)}{!actionable.length && <div className="barangay-empty"><strong>No pending actions</strong><p>Your queue is up to date. Completed reports remain available in My Incidents.</p></div>}<Link className="barangay-incident-link" to="/barangay/incidents">View all authorized incidents &rarr;</Link></section>
      <section className="barangay-incident-panel"><h2>Recent activity</h2><p>Latest recorded events from reports you can access.</p>{activity.length ? <ol className="barangay-activity">{activity.map((item) => <li key={item.id}><Link to={detailLink(item.reportId)}><strong>{item.label}</strong><span>{item.type}</span></Link><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol> : <div className="barangay-empty">No incident activity recorded yet.</div>}<Link className="barangay-incident-link" to="/barangay/incidents?queue=Resolved">View resolved and closed reports &rarr;</Link></section></div>
      <aside>
      <section className="barangay-incident-panel"><h2>Your jurisdiction</h2><dl className="barangay-jurisdiction">{[['Barangay', user.jurisdiction?.barangay], ['Municipality / City', user.jurisdiction?.municipalityOrCity], ['Role', 'Barangay Personnel'], ['Accessible reports', reports.length]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not assigned'}</dd></div>)}</dl><p>Review community reports, coordinate response and confirm final closure within your assigned jurisdiction.</p><div className="barangay-quick-links"><Link to="/barangay/map">Open incident map &rarr;</Link><Link to="/barangay/analytics">Reports &amp; analytics &rarr;</Link></div></section></aside></div>
      : <section className="barangay-incident-panel"><h2>My Incidents</h2><label className="barangay-incident-search">Search incidents<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, incident type or location" /></label><p role="status">{filtered.length} matching reports. Referred is a queue, not a report status. Verified local reports appear in In Progress while awaiting response.</p><div className="barangay-incident-list">{filtered.map((report) => <IncidentCard key={report.id} report={report} />)}</div>{!filtered.length && <p>No incidents match this queue or search.</p>}</section>}
  </div>;
}
