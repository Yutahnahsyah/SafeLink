import { SectionSkeleton, RefreshNotice } from './PageSkeletons';
import { useMemo, useState } from "react";
import Icon from "./Icon";
import FieldRequirement from "./FieldRequirement";
import { OpenNotificationsButton } from "./NotificationBell";
import LguShell from "./LguShell";
import WorkspaceSettings from "./WorkspaceSettings";
import SafeLinkMap from "./maps/SafeLinkMap";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import ProtectedEvidence from "./ProtectedEvidence";
import { useLguSafetyMap } from '../services/useLguSafetyMap';
import { buildLguSafetyMap, isLguBoundaryError, MAP_FILTER_OPTIONS, MAP_DATE_OPTIONS, EMPTY_MAP_FILTERS } from '../services/lguSafetyMap.mjs';
import {
  useLguIncident,
  useLguIncidents,
  useLguNotifications,
  useLguPersonnel,
  processLguIncident,
  lguCapabilities,
} from "../lguData";
import {
  getLguJurisdiction,
  getLguMapView,
  isRecordWithinJurisdiction,
  scopeLguRecords,
} from "../lguScope";

const workflowStatuses = ["Submitted", "Under Barangay Review", "Verified", "Rejected", "In Progress", "Resolved", "Closed"];
const timelineStages = [
  ["Submitted", "Citizen report submitted"],
  ["Under Barangay Review", "Barangay review"],
  ["Verified", "Report verified"],
  ["In Progress", "Response in progress"],
  ["Resolved", "Resolved"],
  ["Closed", "Closed"],
];

const statusClass = (status = "") => `lgu-status status-${status.toLowerCase().replaceAll(" ", "-")}`;
const priorityClass = (priority = "") => `lgu-priority priority-${priority.toLowerCase()}`;

function OperationalState({ result, icon = "shield", unavailable, empty, error, variant = "list", errorTitle = "Unable to load data" }) {
  if (result?.status === "loading") return <SectionSkeleton variant={variant} label="Loading operational records" />;
  const isError = result?.status === "error";
  const isUnavailable = !result?.available || result?.status === "unavailable";
  return <div className={`lgu-data-state${isError ? " is-error" : ""}`} role={isError ? "alert" : "status"}>
    <span><Icon name={isError ? "priority" : icon} size={25} /></span>
    <div><strong>{isError ? errorTitle : isUnavailable ? "API connection required" : "Nothing here yet"}</strong><p>{isError ? error : isUnavailable ? unavailable : empty}</p>{isError && result.retry && <button type="button" onClick={result.retry}>Retry</button>}</div>
  </div>;
}

function MapLoadingError({ result }) {
  const boundaryError = !result.error || isLguBoundaryError(result.error);
  return <OperationalState result={{ ...result, status: 'error' }} icon="map"
    errorTitle={boundaryError ? 'Jurisdiction boundary unavailable' : 'Unable to load map incidents'}
    error={result.error?.message || 'No municipality boundary matches the assigned LGU jurisdiction. Ask your administrator to check the municipality or city.'} />;
}

function Metric({ icon, label, value, tone }) {
  return <article className={`lgu-metric lgu-metric--${tone}`}><span><Icon name={icon} /></span><div><small>{label}</small><strong>{value === null ? <span className="sl-placeholder" style={{ width: 50, height: 30 }} aria-hidden="true" /> : value}</strong><em>{value === "—" ? "Awaiting API connection" : "Current assignments"}</em></div></article>;
}

function PageHeading({ eyebrow, title, children, action }) {
  return <div className="lgu-page-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>{action}</div>;
}

function JurisdictionLabel({ area }) {
  return <p className="lgu-jurisdiction"><Icon name="map" size={14} /> Jurisdiction: <strong>{area || "Not assigned"}</strong></p>;
}

function FilterBar({ query, setQuery, status, setStatus, includeStatus = true, disabled = false }) {
  return <div className="lgu-filters" aria-label="Incident filters">
    <label className="lgu-search"><Icon name="report" size={18} /><span className="lgu-filter-label">Search incidents</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, incident, or location" disabled={disabled} /></label>
    {includeStatus && <label><span className="lgu-filter-label">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} disabled={disabled}><option value="all">All statuses</option>{workflowStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>}
    <label><span className="lgu-filter-label">Category</span><select disabled={disabled} defaultValue="all"><option value="all">All categories</option></select></label>
    <label><span className="lgu-filter-label">Priority</span><select disabled={disabled} defaultValue="all"><option value="all">All priorities</option></select></label>
    <label><span className="lgu-filter-label">Barangay</span><select disabled={disabled} defaultValue="all"><option value="all">All barangays</option></select></label>
    <label><span className="lgu-filter-label">Date</span><select disabled={disabled} defaultValue="all"><option value="all">Any date</option></select></label>
  </div>;
}

function IncidentList({ result, jurisdiction, mode = "assigned" }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const incidents = scopeLguRecords(result.data || [], jurisdiction);
  const filtered = useMemo(() => incidents.filter((incident) => {
    const text = `${incident.id || ""} ${incident.title || incident.type || incident.category || ""} ${incident.location || ""}`.toLowerCase();
    const queryMatches = text.includes(query.trim().toLowerCase());
    const statusMatches = status === "all" || incident.status === status;
    const modeMatches = mode === "active"
      ? incident.status === "In Progress"
      : mode === "resolved" ? ["Resolved", "Closed"].includes(incident.status) : true;
    return queryMatches && statusMatches && modeMatches;
  }), [incidents, mode, query, status]);

  return <section className="citizen-card lgu-list-card">
    <FilterBar query={query} setQuery={setQuery} status={status} setStatus={setStatus} includeStatus={mode === "assigned"} disabled={!result.available} />
    <RefreshNotice result={result} />{result.status === "loading" ? <SectionSkeleton variant="table" rows={5} columns={7} label="Loading assigned incidents" /> : !result.available || result.status === "error" ? <OperationalState result={result} icon={mode === "resolved" ? "check" : "report"} unavailable={mode === "active" ? `Active response data for ${jurisdiction} is not available until the LGU incidents API is connected.` : mode === "resolved" ? `Resolved incident records for ${jurisdiction} are not available until the LGU incidents API is connected.` : `Assigned incidents for ${jurisdiction} are not available until the LGU incidents API is connected.`} error="We couldn't load assigned incidents. Please try again." /> : filtered.length ? <div className="lgu-incident-table">
      <div className="lgu-incident-head"><span>Incident</span><span>Location</span><span>{mode === "resolved" ? "Resolved" : "Assigned"}</span><span>Priority</span><span>Status</span><span>Latest update</span><span>Action</span></div>
      {filtered.map((incident) => <article className="lgu-incident-row" key={incident.id}>
        <div><strong>{incident.title || incident.type || incident.category || "Incident"}</strong><small>{incident.id}</small></div>
        <span data-label="Location">{incident.location || "Not provided"}</span>
        <span data-label={mode === "resolved" ? "Resolved" : "Assigned"}>{mode === "resolved" ? incident.resolvedAt : incident.assignedAt || "Not provided"}</span>
        <span data-label="Priority"><b className={priorityClass(incident.priority)}>{incident.priority || "Not set"}</b></span>
        <span data-label="Status"><b className={statusClass(incident.status)}>{incident.status}</b></span>
        <span className="lgu-latest-update" data-label="Latest update">{incident.latestUpdate || "No update available"}</span>
        <Link aria-label={`View incident ${incident.id}`} to={`/lgu/incidents/${encodeURIComponent(incident.id)}`}>View <Icon name="arrow" size={16} /></Link>
      </article>)}
    </div> : <OperationalState result={{ available: true }} icon={mode === "resolved" ? "check" : "report"} empty={mode === "active" ? `No active responses in ${jurisdiction} right now.` : mode === "resolved" ? `No resolved incidents are available for ${jurisdiction} yet.` : `No incidents are currently assigned to ${jurisdiction} LGU.`} />}
  </section>;
}

export function LguDashboardPage() {
  const { user } = useAuth();
  const incidentsResult = useLguIncidents(user);
  const personnelResult = useLguPersonnel(user);
  const notificationResult = useLguNotifications(user);
  const jurisdiction = getLguJurisdiction(user);
  const incidents = scopeLguRecords(incidentsResult.data || [], jurisdiction);
  const safetyMapResult = useLguSafetyMap(user, jurisdiction);
  const { items: mapItems } = buildLguSafetyMap(safetyMapResult.data, jurisdiction);
  const mapView = useMemo(() => getLguMapView(jurisdiction, safetyMapResult.data?.boundary), [jurisdiction, safetyMapResult.data?.boundary]);
  const count = (statuses) => incidentsResult.status === "loading" ? null : incidentsResult.status === 'success' && incidentsResult.available ? incidents.filter((item) => statuses.includes(item.status)).length : "—";
  const metrics = [
    ["report", "Submitted", count(["Submitted"]), "assigned"],
    ["shield", "Under Barangay Review", count(["Under Barangay Review"]), "acknowledged"],
    ["priority", "In Progress", count(["In Progress"]), "responding"],
    ["check", "Resolved", count(["Resolved", "Closed"]), "resolved"],
  ];
  return <LguShell title={`${jurisdiction || "Assigned"} LGU Dashboard`} eyebrow="Local incident response">
    <section className="lgu-ops-bar">
      <div><span className="lgu-ops-signal"><i /> Local operations online</span><h2>{jurisdiction} response desk</h2><p>What needs our attention right now?</p></div>
      <JurisdictionLabel area={jurisdiction} />
      <div className="lgu-ops-actions"><Link className="button" to="/lgu/incidents">Open assignment queue <Icon name="arrow" size={15} /></Link><Link to="/lgu/active-response"><Icon name="priority" size={15} /> Active response</Link></div>
    </section>
    <section className="lgu-workflow-strip" aria-label="LGU response workflow">{[["report", "Submitted"], ["shield", "Verified"], ["priority", "In Progress"], ["check", "Resolved"]].map(([icon, label], index) => <div key={label}><span><Icon name={icon} size={15} /></span><strong>{label}</strong>{index < 3 && <Icon name="arrow" size={13} />}</div>)}</section>
    <section className="lgu-metrics" aria-label="LGU incident summary">{metrics.map(([icon, label, value, tone]) => <Metric key={label} icon={icon} label={label} value={value} tone={tone} />)}</section>
    <div className="lgu-dashboard-grid">
      <section className="citizen-card lgu-map-panel"><header><div><span className="lgu-eyebrow">Authorized {jurisdiction} view</span><h2>Assignment Map</h2></div><Link to="/lgu/map">Open map <Icon name="arrow" size={14} /></Link></header><div className="lgu-dashboard-map">{safetyMapResult.status === "loading" ? <SectionSkeleton variant="map" label="Loading LGU assignment map" /> : !mapView || safetyMapResult.status === "error" ? <MapLoadingError result={safetyMapResult} /> : <SafeLinkMap key={`${user?.id}:${jurisdiction}`} mode="incidents" items={mapItems} focusView={mapView} compact />}</div>{!incidentsResult.available && <p className="lgu-panel-note"><Icon name="shield" size={14} /> No assigned markers are shown because the LGU incidents API is not connected.</p>}</section>
      <section className="citizen-card lgu-assigned-panel"><header><div><span className="lgu-eyebrow">Administrator assignments</span><h2>Newly Assigned</h2></div><Link to="/lgu/incidents">View queue</Link></header><OperationalState result={incidentsResult} icon="report" unavailable={`Newly assigned ${jurisdiction} incidents will appear after the LGU incidents API is connected.`} empty={`No incidents are currently assigned to ${jurisdiction} LGU.`} error="We couldn't load new assignments. Please try again." /></section>
      <section className="citizen-card lgu-active-panel"><header><div><span className="lgu-eyebrow">Current operations</span><h2>Active Response</h2></div><Link to="/lgu/active-response">View all</Link></header><OperationalState result={incidentsResult} icon="priority" unavailable="Active response cases will appear after the LGU incidents API is connected." empty="There are no active responses right now." error="We couldn't load active responses. Please try again." /></section>
      <section className="citizen-card lgu-activity-panel"><header><div><span className="lgu-eyebrow">Assignment feed</span><h2>Latest Updates</h2></div><OpenNotificationsButton>Notifications</OpenNotificationsButton></header><RefreshNotice result={notificationResult} />{notificationResult.data.length ? <div className="lgu-update-list">{notificationResult.data.slice(0,3).map(item=><article key={item.id}><span><Icon name="bell" size={16}/></span><div><strong>{item.title}</strong><p>{item.body||item.message}</p><small>{item.timestamp}</small></div></article>)}</div> : <OperationalState result={notificationResult} icon="bell" unavailable="LGU notifications are not available yet." empty="There are no recent updates." error="We couldn't load LGU updates. Please try again." />}</section>
      <section className="citizen-card lgu-personnel-panel"><header><div><span className="lgu-eyebrow">Resource visibility</span><h2>Personnel</h2></div><Link to="/lgu/personnel">View personnel</Link></header><OperationalState result={personnelResult} icon="users" unavailable="Personnel information is not available yet." empty="No personnel records were returned." error="We couldn't load personnel information. Please try again." /></section>
    </div>
  </LguShell>;
}

export function LguIncidentsPage() {
  const { user } = useAuth();
  const result = useLguIncidents(user);
  const jurisdiction = getLguJurisdiction(user);
  return <LguShell title="Assigned Incidents" eyebrow={`${jurisdiction} jurisdiction`}><PageHeading eyebrow="Assignment queue" title={`Incidents assigned to ${jurisdiction} LGU`}>Search and monitor incidents routed to your office by SafeLink Admin.</PageHeading><JurisdictionLabel area={jurisdiction} /><IncidentList result={result} jurisdiction={jurisdiction} /></LguShell>;
}

export function LguActiveResponsePage() {
  const { user } = useAuth();
  const result = useLguIncidents(user);
  const jurisdiction = getLguJurisdiction(user);
  return <LguShell title="Active Response" eyebrow={`${jurisdiction} jurisdiction`}><PageHeading eyebrow="Live operations" title={`Active response in ${jurisdiction}`}>Focus on acknowledged assignments and incidents with a response in progress.</PageHeading><JurisdictionLabel area={jurisdiction} /><IncidentList result={result} jurisdiction={jurisdiction} mode="active" /></LguShell>;
}

export function LguResolvedPage() {
  const { user } = useAuth();
  const result = useLguIncidents(user);
  const jurisdiction = getLguJurisdiction(user);
  return <LguShell title="Resolved Incidents" eyebrow={`${jurisdiction} jurisdiction`}><PageHeading eyebrow="Response archive" title={`Resolved ${jurisdiction} assignments`}>Review completed incidents handled by your LGU. This workspace is read-only.</PageHeading><JurisdictionLabel area={jurisdiction} /><IncidentList result={result} jurisdiction={jurisdiction} mode="resolved" /></LguShell>;
}

function IncidentTimeline({ incident }) {
  const statusOrder = ["Submitted", "Under Barangay Review", "Verified", "In Progress", "Resolved", "Closed"];
  const currentIndex = Math.max(statusOrder.indexOf(incident.status), 0);
  return <div className="lgu-timeline">{timelineStages.map(([status, label], index) => {
    const history = incident.statusHistory?.find((item) => item.status === status);
    const complete = index < currentIndex || Boolean(history);
    const current = index === currentIndex;
    return <div className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={status}><span>{complete ? <Icon name="check" size={14} /> : index + 1}</span><div><strong>{label}</strong><small>{history?.timestamp || (current ? "Current stage" : complete ? "Completed" : "Pending")}</small>{history?.message && <p>{history.message}</p>}</div></div>;
  })}</div>;
}

export function LguIncidentDetailPage({ id }) {
  const { user } = useAuth();
  const result = useLguIncident(user, id);
  const personnelResult = useLguPersonnel(user);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [assignmentAgency, setAssignmentAgency] = useState("");
  const [assignmentPersonnel, setAssignmentPersonnel] = useState("");
  const incident = result.data;
  const jurisdiction = getLguJurisdiction(user);
  const denied = result.outOfScope || (incident && !isRecordWithinJurisdiction(incident, jurisdiction));
  if (denied) return <LguShell title="Access Denied" eyebrow={`${jurisdiction} jurisdiction`}><section className="citizen-card lgu-access-denied" role="alert"><span><Icon name="shield" size={28} /></span><h2>You do not have access to this incident.</h2><p>Only incidents assigned to {jurisdiction} LGU are available in this workspace.</p><Link className="button" to="/lgu/incidents">Return to Assigned Incidents</Link></section></LguShell>;
  if (!result.available || result.status === "loading" || result.status === "error") return <LguShell title="Incident Workspace" eyebrow={id}><PageHeading eyebrow="Operational case" title={`Incident ${id}`}>Authorized details and response controls appear here when returned by the LGU API.</PageHeading><section className="citizen-card"><OperationalState result={result} variant="form" icon="report" unavailable="Incident details are unavailable." error="We couldn't load this assigned incident. Please try again." /></section></LguShell>;
  if (!incident) return <LguShell title="Incident Not Found"><section className="citizen-card lgu-access-denied"><span><Icon name="shield" size={28} /></span><h2>You do not have access to this incident.</h2><p>The incident is not assigned to {jurisdiction} LGU or is no longer available.</p><Link className="button" to="/lgu/incidents">Return to Assigned Incidents</Link></section></LguShell>;

  const latitude = Number(incident.latitude ?? incident.coordinates?.latitude);
  const longitude = Number(incident.longitude ?? incident.coordinates?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapItem = hasCoordinates ? [{ id: incident.id, category: incident.category || incident.type || "Incident", location: incident.location || "Incident location", status: incident.status, time: incident.incidentAt || "Time not provided", color: "#087d85", coords: [longitude, latitude] }] : [];
  const canUpdate = !incident.reassignedAway;
  const currentAgency = incident.assignedAgency || "Unassigned";
  const currentPersonnelId = incident.assignedPersonnelId || "";
  const selectedAgency = assignmentAgency || currentAgency;
  const selectedPersonnelId = assignmentPersonnel || (assignmentAgency ? "" : currentPersonnelId);
  const roleForAgency = { Barangay: "barangay_personnel", LGU: "lgu_personnel", Police: "police_personnel" }[selectedAgency];
  const availablePersonnel = (personnelResult.data || []).filter((person) => person.role === roleForAgency && person.isAssignable);
  const reviewCompleted = incident.priorityConfirmed && ["Verified", "In Progress", "Resolved", "Closed"].includes(incident.status);
  const assignmentAllowed = canUpdate && lguCapabilities.personnelAssignment && reviewCompleted;
  const assignmentChanged = selectedAgency !== currentAgency || selectedPersonnelId !== currentPersonnelId;
  const updateIncident = async (changes) => {
    setProcessing(true); setProcessError("");
    try { await processLguIncident(incident.id, changes); await result.retry(); return true; }
    catch (error) { setProcessError(error?.message || "SafeLink couldn't update this incident."); return false; }
    finally { setProcessing(false); }
  };
  const updateAssignment = async () => {
    const changes = { assignedAgency: selectedAgency };
    if (selectedAgency !== "Unassigned" && selectedPersonnelId) changes.assignedPersonnel = selectedPersonnelId;
    if (await updateIncident(changes)) {
      setAssignmentAgency("");
      setAssignmentPersonnel("");
    }
  };
  const canAdvanceResponse = canUpdate && reviewCompleted && currentAgency === "LGU";
  const nextAction = canAdvanceResponse ? {
    Verified: ["Start Response", "In Progress"],
    "In Progress": ["Resolve Incident", "Resolved"],
  }[incident.status] : null;
  return <LguShell title={incident.title || incident.type || "Incident"} eyebrow={incident.id}>
    {incident.reassignedAway && <p className="lgu-reassignment" role="alert"><Icon name="shield" /> This incident has been reassigned by an administrator. Response controls are no longer available.</p>}
    <div className="lgu-case-header"><div><span className={priorityClass(incident.priority)}>{incident.priority || "Priority not set"}</span><h2>{incident.title || incident.type || incident.category}</h2><p>{incident.location || "Location not provided"}</p></div><b className={statusClass(incident.status)}>{incident.status}</b></div>
    <div className="lgu-case-layout">
      <section className="citizen-card lgu-case-overview"><header><h2>Incident Overview</h2></header><dl>{[["Report ID", incident.id], ["Category", incident.category || incident.type], ["Description", incident.description], ["Incident date / time", incident.incidentAt], ["Submitted", incident.submittedAt], ["Location", incident.location], ["Priority", incident.priority]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <aside className="citizen-card lgu-assignment-card"><header><h2>Assignment Information</h2></header><dl><div><dt>Assigned agency</dt><dd>{currentAgency}</dd></div><div><dt>Assigned personnel</dt><dd>{incident.assignedTo || "Not assigned"}</dd></div><div><dt>Status</dt><dd>{incident.status}</dd></div></dl>{incident.escalation?.requestedAt && !incident.escalation?.acknowledgedAt && <p className="lgu-assignment-note"><Icon name="priority" size={14} /> Barangay requested {incident.escalation.agency} coordination: {incident.escalation.reason}</p>}{assignmentAllowed && <div className="lgu-assignment-form"><label><span className="field-label-row">Assign agency<FieldRequirement optional /></span><select value={selectedAgency} disabled={processing} onChange={(event) => { setAssignmentAgency(event.target.value); setAssignmentPersonnel(""); }}><option>Barangay</option><option>LGU</option><option>Police</option><option>Unassigned</option></select></label><label><span className="field-label-row">Assign personnel<FieldRequirement optional /></span><select value={selectedPersonnelId} disabled={processing || selectedAgency === "Unassigned" || personnelResult.status === "loading"} onChange={(event) => setAssignmentPersonnel(event.target.value)}><option value="">No individual personnel</option>{availablePersonnel.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.locality || jurisdiction}</option>)}</select></label>{personnelResult.status === "error" && <small role="alert">Personnel could not be loaded. You can still assign the agency.</small>}<button type="button" className="button button-muted" disabled={processing || !assignmentChanged} onClick={updateAssignment}>{processing ? "Saving assignment..." : "Save Assignment"}</button></div>}{!assignmentAllowed && canUpdate && <p className="lgu-assignment-note"><Icon name="shield" size={14} /> Barangay must complete review and confirm the official priority before LGU can assign personnel or update the response.</p>}{processError && <p className="form-error" role="alert">{processError}</p>}{canAdvanceResponse && <div className="lgu-response-controls">{nextAction && <button className="button" disabled={processing} onClick={() => updateIncident({ status: nextAction[1] })}>{processing ? "Updating..." : nextAction[0]}</button>}{incident.status === "Resolved" && <p className="lgu-assignment-note"><Icon name="shield" size={14} /> Waiting for Barangay final closure confirmation.</p>}</div>}</aside>
      <section className="citizen-card lgu-location-card"><header><div><h2>Incident Location</h2><p>{incident.location}</p></div></header>{hasCoordinates ? <><div><SafeLinkMap mode="incidents" items={mapItem} focusView={{ center: [latitude, longitude], zoom: 15, label: `${jurisdiction} incident` }} compact /></div><small>{latitude.toFixed(6)}, {longitude.toFixed(6)}</small></> : <OperationalState result={{ available: true }} icon="map" empty="No authorized coordinates were returned for this incident." />}</section>
      <section className="citizen-card lgu-timeline-card"><header><h2>Response Timeline</h2></header><IncidentTimeline incident={incident} /></section>
      <section className="citizen-card lgu-evidence-card"><header><h2>Evidence</h2></header>{incident.evidence?.length ? <div className="lgu-evidence-grid">{incident.evidence.map((item) => <ProtectedEvidence incidentId={incident.id} item={item} key={item.id} />)}</div> : <OperationalState result={{ available: true }} icon="camera" empty="No permitted evidence was returned for this incident." />}</section>
      <section className="citizen-card lgu-updates-card"><header><div><h2>Response Updates</h2><p>Operational progress returned by the LGU API.</p></div></header>{incident.responseUpdates?.length ? <div className="lgu-update-list">{incident.responseUpdates.map((update) => <article key={update.id}><span><Icon name="check" size={14} /></span><div><strong>{update.title}</strong>{update.message && <p>{update.message}</p>}<small>{update.timestamp}</small></div></article>)}</div> : <OperationalState result={{ available: true }} icon="history" empty="No response updates have been recorded." />}{canUpdate && lguCapabilities.responseUpdates && <button className="button" disabled={processing} onClick={() => { const remarks = window.prompt("Add an operational note"); if (remarks?.trim()) updateIncident({ remarks: remarks.trim() }); }}>Add Response Update</button>}</section>
    </div>
  </LguShell>;
}

export function LguPersonnelPage() {
  const { user } = useAuth();
  const result = useLguPersonnel(user);
  const jurisdiction = getLguJurisdiction(user);
  const personnel = scopeLguRecords(result.data || [], jurisdiction);
  const statusClass = (kind, value) => `${kind} ${kind}--${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <LguShell title="Personnel" eyebrow={`${jurisdiction} resource visibility`}><PageHeading eyebrow="Response resources" title={`${jurisdiction} personnel`}>View personnel accounts and their status for your office.</PageHeading><JurisdictionLabel area={jurisdiction} /><section className="citizen-card lgu-list-card"><RefreshNotice result={result} />{result.status === "loading" ? <SectionSkeleton variant="list" label="Loading LGU personnel" /> : !result.available || result.status === "error" ? <OperationalState result={result} icon="users" unavailable={`Personnel information for ${jurisdiction} is not available yet. The current client has no connected personnel endpoint.`} error="We couldn't load personnel information. Please try again." /> : personnel.length ? <div className="lgu-personnel-grid">{personnel.map((person) => <article key={person.id}><span><Icon name="users" /></span><div><strong>{person.name}</strong><small>{[person.role, person.unit].filter(Boolean).join(" · ")}</small><p>{person.currentAssignment || "No current assignment"}</p></div><div className="lgu-personnel-statuses"><b className={statusClass("lgu-personnel-badge", `account-${person.accountStatus}`)}>Account: {person.accountStatus}</b></div></article>)}</div> : <OperationalState result={{ available: true }} icon="users" empty={`No personnel records were returned for ${jurisdiction} LGU.`} />}</section></LguShell>;
}

export function LguMapPage() {
  const { user } = useAuth();
  const jurisdiction = typeof user?.jurisdiction?.municipalityOrCity === 'string' ? user.jurisdiction.municipalityOrCity.trim() : '';
  const result = useLguSafetyMap(user, jurisdiction);
  const accountKey = `${user?.id || ''}:${jurisdiction}`;
  const [selection, setSelection] = useState({ key: accountKey, values: EMPTY_MAP_FILTERS });
  const filters = selection.key === accountKey ? selection.values : EMPTY_MAP_FILTERS;
  const update = (field) => (event) => setSelection({ key: accountKey, values: { ...filters, [field]: event.target.value } });
  const reset = () => setSelection({ key: accountKey, values: EMPTY_MAP_FILTERS });
  const ready = result.available && result.status === 'success';
  const { items: mapItems, barangays, total } = buildLguSafetyMap(ready ? result.data : null, jurisdiction, filters);
  const mapView = useMemo(() => getLguMapView(jurisdiction, result.data?.boundary), [jurisdiction, result.data?.boundary]);
  const reviewRequired = ready ? result.data?.metadata?.reviewRequired || [] : [];
  const filtered = Object.values(filters).some(Boolean);
  const limit = result.data?.metadata?.resultLimit;
  return <LguShell title="LGU Safety Map" eyebrow={`${jurisdiction} assignment locations`}>
    <PageHeading eyebrow="Location intelligence" title={`${jurisdiction} assigned incident map`}>Visualize only incidents authorized and assigned to your LGU.</PageHeading>
    <JurisdictionLabel area={jurisdiction} />
    <section className="citizen-card lgu-map-page">
      <div className="lgu-map-filters">
        {['status', 'category', 'priority'].map((field) => <select key={field} value={filters[field]} onChange={update(field)} disabled={!ready} aria-label={`Filter map by ${field}`}>
          <option value="">All {field === 'priority' ? 'priorities' : field === 'category' ? 'categories' : 'statuses'}</option>
          {MAP_FILTER_OPTIONS[field].map(value => <option value={value} key={value}>{value}</option>)}
        </select>)}
        <select value={filters.barangay} onChange={update('barangay')} disabled={!ready} aria-label="Filter map by barangay">
          <option value="">All barangays</option>
          {barangays.map(value => <option value={value} key={value}>{value}</option>)}
          {ready && filters.barangay && !barangays.includes(filters.barangay) && <option value={filters.barangay}>{filters.barangay} (no current incidents)</option>}
          {!barangays.length && <option disabled>No barangays in available map data</option>}
        </select>
        <select value={filters.date} onChange={update('date')} disabled={!ready} aria-label="Filter map by date">
          <option value="">Any date</option>
          {MAP_DATE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      <div className="lgu-map-filter-summary"><span role="status" aria-live="polite">{ready ? `${mapItems.length} of ${total} authorized map incidents shown` : 'Map filters are available after authorized locations load.'}</span><button type="button" className="button button-muted" onClick={reset} disabled={!filtered}>Clear filters</button></div>
      <RefreshNotice result={result} />
      {reviewRequired.length > 0 && <details className="lgu-map-disclosure"><summary>{reviewRequired.length} reports need location review and are excluded from map markers.</summary><p>Saved locations have not been changed. Review the original report before correcting municipality or coordinate information.</p><ul>{reviewRequired.map(report => <li key={report.id}><Link to={`/lgu/incidents/${encodeURIComponent(report.id)}`}>Report {report.id}</Link>: {report.reason === 'municipality_coordinate_mismatch' ? `Saved coordinates fall in ${report.detectedMunicipalities.join(' / ')} rather than ${report.municipalityOrCity}.` : report.reason === 'invalid_coordinates' ? 'Missing or invalid saved coordinates.' : 'The saved coordinates could not be confirmed within the municipality boundary.'}</li>)}</ul></details>}
      {ready && !mapItems.length && <p className="lgu-map-empty" role="status">{!total ? 'No authorized incidents with map coordinates are available for your jurisdiction.' : 'No incidents match these filters. Clear filters or choose another combination.'}</p>}
      {ready && limit && result.data?.metadata?.returned >= limit && <p className="lgu-map-disclosure">The map API returns up to {limit} locations. Filters apply to these loaded locations.</p>}
      <div className="lgu-map-large">{result.status === 'loading' ? <SectionSkeleton variant="map" label="Loading LGU safety map" /> : !mapView || result.status === 'error' ? <MapLoadingError result={result} /> : <SafeLinkMap key={accountKey} mode="incidents" items={mapItems} focusView={mapView} />}</div>
    </section>
  </LguShell>;
}

export function LguProfilePage() {
  const { user } = useAuth();
  const name = user?.name || user?.fullName || "LGU Personnel";
  const jurisdiction = getLguJurisdiction(user);
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <LguShell title="Profile" eyebrow="LGU account information"><section className="profile-hero lgu-profile-hero"><div className="profile-photo"><span>{initials}</span></div><div className="profile-identity"><span>{jurisdiction} LGU account</span><h2>{name}</h2><p>{user?.jobTitle || "LGU Personnel"}</p><b className="verification"><Icon name="shield" size={14} /> {user?.isDevelopmentPreview ? "Display-only preview account" : user?.accountStatus || "Account status unavailable"}</b></div></section><div className="profile-sections"><section className="citizen-card profile-info-section"><header><span><Icon name="users" /></span><div><small>Identity</small><h2>Personnel information</h2></div></header><dl><div><dt>Name</dt><dd>{name}</dd></div><div><dt>LGU role</dt><dd>{user?.jobTitle || "LGU Personnel"}</dd></div><div><dt>Email</dt><dd>{user?.email || "Not available"}</dd></div><div><dt>Account status</dt><dd>{user?.accountStatus || (user?.isDevelopmentPreview ? "Development preview" : "Not available")}</dd></div></dl></section><section className="citizen-card profile-info-section"><header><span><Icon name="map" /></span><div><small>Office</small><h2>LGU assignment</h2></div></header><dl><div><dt>Jurisdiction</dt><dd>{jurisdiction || "Not available"}</dd></div><div><dt>Office / municipality</dt><dd>{user?.office || user?.municipality || "Not available"}</dd></div></dl></section></div><p className="profile-capability-note"><Icon name="shield" size={16} /> Profile editing remains read-only until a supported LGU profile API is connected.</p></LguShell>;
}

export function LguSettingsPage() {
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const signOut = () => { logout(); navigate("/login", { replace: true }); };
  return <LguShell title="Settings" eyebrow="Account, privacy, and security"><WorkspaceSettings scope="LGU workspace" heading="Keep your account secure and your operational information protected." privacy="Incident information is limited to authorized assignments. Citizen contact details are not shown here." onSignOut={signOut} /></LguShell>;
}
