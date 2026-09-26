import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AdminShell from "./AdminShell";
import Icon from "./Icon";
import SafeLinkMap from "./maps/SafeLinkMap";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import {
  adminCapabilities,
  getAdminLgus,
  useAdminNotifications,
  useAdminPersonnel,
  useAdminReport,
  useAdminReports,
  getAdminUsers,
  processAdminIncident,
  approveAdminPersonnel,
  useAdminAnalytics,
  useAuditLogs,
} from "../adminData";
import ProtectedEvidence from "./ProtectedEvidence";
import { notificationApi } from "../services/safelinkApi";
import {
  accountApiCapabilities,
  approvePersonnelAccount,
  createPersonnelAccount,
  fetchPendingPersonnel,
  personnelListFrom,
} from "../services/accountApi";

const reportStatuses = ["Submitted", "Under Validation", "Verified", "Rejected", "In Progress", "Resolved", "Closed"];
const lifecycle = ["Submitted", "Under Validation", "Verified", "In Progress", "Resolved", "Closed"];
const dash = "—";
const statusClass = (value = "") => `admin-chip status-${String(value).toLowerCase().replaceAll(" ", "-")}`;
const priorityClass = (value = "") => `admin-chip priority-${String(value).toLowerCase()}`;

function DataState({ result, icon = "shield", unavailable, empty, error }) {
  if (result?.status === "loading") return <div className="admin-loading" role="status"><span /><span /><span /><p>Loading operational data…</p></div>;
  const failed = result?.status === "error";
  const disconnected = !result?.available || result?.status === "unavailable";
  return <div className={`admin-data-state${failed ? " is-error" : ""}`} role={failed ? "alert" : "status"}><span><Icon name={failed ? "priority" : icon} size={25} /></span><div><strong>{failed ? "Unable to load data" : disconnected ? "API connection required" : "Nothing here yet"}</strong><p>{failed ? error : disconnected ? unavailable : empty}</p></div></div>;
}

function PageHeading({ eyebrow, title, children, action }) {
  return <div className="admin-page-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>{action}</div>;
}

function Metric({ icon, label, value, tone = "teal" }) {
  return <article className={`admin-metric is-${tone}`}><span><Icon name={icon} /></span><div><small>{label}</small><strong>{value}</strong><em>{value === dash ? "Awaiting API connection" : "Province-wide total"}</em></div></article>;
}

function PanelHeader({ eyebrow, title, to, link = "View all" }) {
  return <header><div><span>{eyebrow}</span><h2>{title}</h2></div>{to && <Link to={to}>{link} <Icon name="arrow" size={14} /></Link>}</header>;
}

function CompactReports({ result, statuses, empty, unavailable }) {
  if (!result.available || result.status === "error") return <DataState result={result} icon="report" unavailable={unavailable} empty={empty} error="We couldn't load this report group." />;
  const items = (result.data || []).filter((item) => statuses.includes(item.status)).slice(0, 3);
  if (!items.length) return <DataState result={{ available: true }} icon="report" empty={empty} />;
  return <div className="admin-compact-list">{items.map((item) => <Link to={`/admin/reports/${encodeURIComponent(item.id)}`} key={item.id}><span><strong>{item.title || item.category || "Incident report"}</strong><small>{item.id} · {item.municipality || item.city || "Locality unavailable"}</small></span><b className={statusClass(item.status)}>{item.status}</b><Icon name="arrow" size={14} /></Link>)}</div>;
}

function CompactNotifications({ result }) {
  if (!result.available || result.status === "error") return <DataState result={result} icon="bell" unavailable="Administrator notifications are not connected yet." empty="There are no recent notifications." error="We couldn't load notifications." />;
  const items = (result.data || []).slice(0, 3);
  if (!items.length) return <DataState result={{ available: true }} icon="bell" empty="There are no recent notifications." />;
  return <div className="admin-compact-list">{items.map((item) => <Link to={item.reportId ? `/admin/reports/${encodeURIComponent(item.reportId)}` : "/admin/notifications"} key={item.id}><span><strong>{item.title}</strong><small>{item.timestamp || "Time unavailable"}</small></span>{item.unread && <i aria-label="Unread" />}<Icon name="arrow" size={14} /></Link>)}</div>;
}

function CompactPersonnel({ result }) {
  if (!result.available || result.status === "error") return <DataState result={result} icon="users" unavailable="Pending personnel approvals are not connected yet." empty="No personnel approval requests are pending." error="We couldn't load personnel approvals." />;
  const items = (result.data || []).filter((item) => item.status === "Pending").slice(0, 3);
  if (!items.length) return <DataState result={{ available: true }} icon="users" empty="No personnel approval requests are pending." />;
  return <div className="admin-compact-list">{items.map((item) => <Link to="/admin/personnel" key={item.id}><span><strong>{item.name}</strong><small>{item.requestedRole} · {item.office || item.locality || "Office unavailable"}</small></span><b className={statusClass(item.status)}>{item.status}</b><Icon name="arrow" size={14} /></Link>)}</div>;
}

function ReportFilters({ result, reports, query, setQuery, status, setStatus }) {
  const municipalities = [...new Set(reports.map((item) => item.municipality || item.city).filter(Boolean))].sort();
  const lgus = [...new Set(reports.map((item) => item.assignedLgu).filter(Boolean))].sort();
  const disabled = !result.available;
  return <div className="admin-filters" aria-label="Report filters">
    <label className="admin-search"><Icon name="report" size={16} /><span className="sr-only">Search reports</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, incident, or location" disabled={disabled} /></label>
    <label><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} disabled={disabled}><option value="all">All statuses</option>{reportStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span className="sr-only">Category</span><select disabled={disabled}><option>All categories</option></select></label>
    <label><span className="sr-only">Priority</span><select disabled={disabled}><option>All priorities</option></select></label>
    <label><span className="sr-only">Municipality or city</span><select disabled={disabled}><option>All Pangasinan</option>{municipalities.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span className="sr-only">Assigned LGU</span><select disabled={disabled}><option>All assigned LGUs</option>{lgus.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span className="sr-only">Date</span><select disabled={disabled}><option>Any date</option></select></label>
  </div>;
}

function ReportList({ result, mode = "all", initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("all");
  const reports = result.data || [];
  const filtered = useMemo(() => reports.filter((report) => {
    const searchable = `${report.id || ""} ${report.title || report.category || ""} ${report.location || ""} ${report.municipality || report.city || ""}`.toLowerCase();
    const matchesQuery = searchable.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || report.status === status;
    const matchesMode = mode === "review" ? ["Submitted", "Under Validation"].includes(report.status) : true;
    return matchesQuery && matchesStatus && matchesMode;
  }), [mode, query, reports, status]);
  return <section className="admin-card admin-report-list">
    <ReportFilters result={result} reports={reports} query={query} setQuery={setQuery} status={status} setStatus={setStatus} />
    {!result.available || result.status === "error" ? <DataState result={result} icon="report" unavailable={mode === "review" ? "Pending-review reports are unavailable until the Administrator reports API is connected." : "Province-wide reports are unavailable until the Administrator reports API is connected."} error="We couldn't load reports. Please try again." /> : filtered.length ? <div className="admin-report-table">
      <div className="admin-report-head"><span>Report</span><span>Location</span><span>Submitted</span><span>Priority</span><span>Status</span><span>Assigned LGU</span><span>Latest update</span><span /></div>
      {filtered.map((report) => <article className="admin-report-row" key={report.id}><div><strong>{report.title || report.category || "Incident report"}</strong><small>{report.id} · {report.category || "Uncategorized"}</small>{mode === "review" && <p>{report.description || "No description provided"}</p>}</div><span data-label="Location">{report.location || report.municipality || report.city || "Not provided"}</span><span data-label="Submitted">{report.submittedAt || "Not provided"}</span><span data-label="Priority"><b className={priorityClass(report.adminPriority || report.priority)}>{report.adminPriority || report.priority || "Not set"}</b></span><span data-label="Status"><b className={statusClass(report.status)}>{report.status}</b></span><span data-label="Assigned LGU">{report.assignedLgu || "Unassigned"}</span><span data-label="Latest update">{report.latestUpdate || "No update available"}</span><Link to={`/admin/reports/${encodeURIComponent(report.id)}`}>{mode === "review" ? "Review Report" : "View"} <Icon name="arrow" size={14} /></Link></article>)}
    </div> : <DataState result={{ available: true }} icon={mode === "review" ? "eye" : "report"} empty={mode === "review" ? "No reports are currently awaiting review." : "No reports match these filters."} />}
  </section>;
}

function ConfirmationDialog({ open, title, message, confirmLabel, danger = false, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="admin-modal" role="alertdialog" aria-modal="true" aria-labelledby="admin-modal-title" aria-describedby="admin-modal-description">
        <span><Icon name={danger ? "priority" : "shield"} size={26} /></span>
        <h2 id="admin-modal-title">{title}</h2>
        <p id="admin-modal-description">{message}</p>
        <div>
          <button type="button" className="button button-muted" onClick={onCancel}>Cancel</button>
          <button type="button" className={`button${danger ? " danger-button" : ""}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const reportsResult = useAdminReports(user);
  const personnelResult = useAdminPersonnel(user);
  const notificationsResult = useAdminNotifications(user);
  const analyticsResult = useAdminAnalytics(user);
  const reports = reportsResult.data || [];
  const statusCounts = analyticsResult.data?.breakdowns?.status;
  const value = (statuses) => statusCounts ? statuses.reduce((total, status) => total + (statusCounts[status] || 0), 0) : reportsResult.available ? reports.filter((item) => statuses.includes(item.status)).length : dash;
  const mapItems = reports.filter((item) => Array.isArray(item.coords) || (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))).map((item) => ({ ...item, coords: item.coords || [Number(item.longitude), Number(item.latitude)], category: item.title || item.category || "Incident", color: item.color || "#08a2aa" }));
  const metrics = [["eye", "Submitted", value(["Submitted"]), "amber"], ["report", "Under Validation", value(["Under Validation"]), "cyan"], ["layers", "Verified", value(["Verified"]), "teal"], ["priority", "In Progress", value(["In Progress"]), "amber"], ["check", "Resolved / Closed", value(["Resolved", "Closed"]), "green"], ["priority", "Rejected", value(["Rejected"]), "red"]];
  return <AdminShell title="Pangasinan Coordination" eyebrow="Pangasinan command center">
    <section className="admin-briefing-strip"><div><span><i /> Provincial coordination status</span><h2>Review. Route. Monitor.</h2><p>Province-wide oversight for citizen reports, LGU assignments, personnel approval, and response progress.</p></div><div><Link className="button" to="/admin/review">Open Review Queue <Icon name="arrow" size={15} /></Link><Link to="/admin/assignments">Assignment Desk</Link></div></section>
    <section className="admin-metrics" aria-label="Province-wide report summary">{metrics.map(([icon, label, metric, tone]) => <Metric key={label} icon={icon} label={label} value={metric} tone={tone} />)}</section>
    <div className="admin-bento">
      <section className="admin-card admin-map-panel"><PanelHeader eyebrow="Province-wide intelligence" title="Pangasinan Incident Map" to="/admin/map" link="Open map" /><div><SafeLinkMap mode="incidents" items={mapItems} compact /></div>{!reportsResult.available && <p className="admin-panel-note"><Icon name="shield" size={14} /> No markers are shown because the Administrator reports API is not connected.</p>}</section>
      <section className="admin-card admin-review-panel"><PanelHeader eyebrow="Admin decision queue" title="Awaiting Review" to="/admin/review" /><CompactReports result={reportsResult} statuses={["Submitted", "Under Validation"]} unavailable="Reports requiring review could not be loaded." empty="No reports are currently awaiting review." /></section>
      <section className="admin-card admin-assignment-panel"><PanelHeader eyebrow="Verified reports" title="Awaiting Referral" to="/admin/assignments" /><CompactReports result={reportsResult} statuses={["Verified"]} unavailable="Verified reports could not be loaded." empty="No verified reports are waiting for referral." /></section>
      <section className="admin-card admin-response-panel"><PanelHeader eyebrow="Response monitoring" title="Active Responses" to="/admin/assignments" /><CompactReports result={reportsResult} statuses={["In Progress"]} unavailable="Active responses could not be loaded." empty="No responses are currently in progress." /></section>
      <section className="admin-card admin-activity-panel"><PanelHeader eyebrow="Operations feed" title="Latest Notifications" to="/admin/notifications" /><CompactNotifications result={notificationsResult} /></section>
      <section className="admin-card admin-personnel-panel"><PanelHeader eyebrow="Account governance" title="Personnel Approvals" to="/admin/personnel" /><CompactPersonnel result={personnelResult} /></section>
      <section className="admin-card admin-quick-panel"><PanelHeader eyebrow="Command shortcuts" title="Quick Actions" /><div><Link to="/admin/review"><Icon name="eye" /><span><strong>Review Reports</strong><small>Evaluate citizen submissions</small></span><Icon name="arrow" size={14} /></Link><Link to="/admin/assignments"><Icon name="layers" /><span><strong>Assign Reports</strong><small>Route accepted incidents</small></span><Icon name="arrow" size={14} /></Link><Link to="/admin/map"><Icon name="map" /><span><strong>Pangasinan Map</strong><small>Monitor province-wide activity</small></span><Icon name="arrow" size={14} /></Link><Link to="/admin/personnel"><Icon name="users" /><span><strong>Review Personnel</strong><small>Manage approval requests</small></span><Icon name="arrow" size={14} /></Link></div></section>
    </div>
  </AdminShell>;
}

export function AdminReportsPage() {
  const { user } = useAuth();
  const { search } = useRouter();
  const result = useAdminReports(user);
  const initialQuery = new URLSearchParams(search).get("search") || "";
  return <AdminShell title="All Reports" eyebrow="Province-wide report registry"><PageHeading eyebrow="Pangasinan coverage" title="Citizen reports and response status">Browse authorized reports across municipalities, review decisions, assignments, and LGU progress.</PageHeading><ReportList result={result} initialQuery={initialQuery} /></AdminShell>;
}

export function AdminReviewPage() {
  const { user } = useAuth();
  const result = useAdminReports(user);
  return <AdminShell title="Pending Review" eyebrow="Administrator decision queue"><PageHeading eyebrow="Review required" title="Reports awaiting Administrator review">Open each report to evaluate its details and evidence before making a deliberate decision.</PageHeading><ReportList result={result} mode="review" /></AdminShell>;
}

function AdminTimeline({ report }) {
  const statusIndex = lifecycle.indexOf(report.status);
  return <div className="admin-timeline">{lifecycle.map((label, index) => { const history = report.statusHistory?.find((item) => item.status === label || item.label === label); const complete = index < statusIndex || Boolean(history); const current = index === statusIndex; return <div className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} key={label}><span>{complete ? <Icon name="check" size={14} /> : index + 1}</span><strong>{label}</strong><small>{history?.timestamp || (current ? "Current stage" : complete ? "Completed" : "Pending")}</small></div>; })}</div>;
}

export function AdminReportDetailPage({ id }) {
  const { user } = useAuth();
  const result = useAdminReport(user, id);
  const report = result.data;
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const [agency, setAgency] = useState("");
  const [severity, setSeverity] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  if (!result.available || result.status === "loading" || result.status === "error") return <AdminShell title="Report Review Workspace" eyebrow={id}><PageHeading eyebrow="Administrator case review" title={`Report ${id}`}>Authorized incident details and processing controls.</PageHeading><section className="admin-card"><DataState result={result} icon="report" unavailable="Report details are unavailable." error="We couldn't load this report. Please try again." /></section></AdminShell>;
  if (!report) return <AdminShell title="Report Not Found"><section className="admin-card"><DataState result={{ available: true }} icon="report" empty="This report is unavailable or outside your authorized access." /></section></AdminShell>;
  const latitude = Number(report.latitude ?? report.coordinates?.latitude);
  const longitude = Number(report.longitude ?? report.coordinates?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapItems = hasCoordinates ? [{ ...report, category: report.title || report.category || "Incident", location: report.location || "Report location", coords: [longitude, latitude], color: "#08a2aa" }] : [];
  const reviewable = ["Submitted", "Under Validation"].includes(report.status);
  const assignable = ["Verified", "In Progress", "Resolved", "Closed"].includes(report.status);
  const executeAction = async () => {
    const changes = confirmation?.type === "review"
      ? { status: decision, ...(note.trim() ? { remarks: note.trim() } : {}) }
      : { ...(agency ? { assignedAgency: agency } : {}), ...(severity ? { severity } : {}), ...(note.trim() ? { remarks: note.trim() } : {}) };
    setActionLoading(true); setActionError("");
    try { await processAdminIncident(report.id, changes); setConfirmation(null); result.retry(); }
    catch (error) { setActionError(error?.message || "SafeLink couldn't process this incident."); setConfirmation(null); }
    finally { setActionLoading(false); }
  };
  return <AdminShell title={report.title || report.category || "Report Review"} eyebrow={report.id}>
    <div className="admin-case-heading"><div><span className={priorityClass(report.adminPriority || report.priority)}>{report.adminPriority || report.priority || "Priority not set"}</span><h2>{report.title || report.category || "Incident report"}</h2><p>{report.location || "Location not provided"}</p></div><b className={statusClass(report.status)}>{report.status}</b></div>
    <div className="admin-case-grid">
      <section className="admin-card admin-overview"><PanelHeader eyebrow="Citizen submission" title="Report Overview" /><dl>{[["Report ID", report.id], ["Category", report.category], ["Description", report.description], ["Incident date / time", report.incidentAt], ["Submitted", report.submittedAt], ["Location", report.location], ["Municipality", report.municipality || report.city], ["Citizen urgency", report.citizenUrgency], ["Admin-confirmed priority", report.adminPriority]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <aside className="admin-card admin-review-decision"><PanelHeader eyebrow="Administrator review" title="Decision" />{reviewable ? <div className="admin-decision-form"><fieldset disabled={actionLoading}><legend className="sr-only">Review decision</legend>{(report.status === "Submitted" ? [["Under Validation", "Start Validation"]] : [["Verified", "Verify Report"], ["Rejected", "Reject Report"]]).map(([value, label]) => <label key={value}><input type="radio" name="review-decision" value={value} checked={decision === value} onChange={(event) => setDecision(event.target.value)} /> <span>{label}</span></label>)}</fieldset><label>Review note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows="4" placeholder="Add an authorized review note" /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<button className="button" disabled={!decision || actionLoading} onClick={() => setConfirmation({ type: "review", label: decision })}>Confirm Decision</button></div> : <DataState result={{ available: true }} icon="check" empty="This report is not currently awaiting an Administrator decision." />}</aside>
      <section className="admin-card admin-location"><PanelHeader eyebrow="Verified coordinates" title="Map Location" />{hasCoordinates ? <div><SafeLinkMap mode="incidents" items={mapItems} focusView={{ center: [latitude, longitude], zoom: 15, label: "report location" }} compact /></div> : <DataState result={{ available: true }} icon="map" empty="No authorized coordinates were returned for this report." />}</section>
      <section className="admin-card admin-evidence"><PanelHeader eyebrow="Submitted media" title="Evidence" />{report.evidence?.length ? <div className="admin-evidence-grid">{report.evidence.map((item) => <ProtectedEvidence incidentId={report.id} item={item} key={item.id} />)}</div> : <DataState result={{ available: true }} icon="camera" empty="No evidence was returned for this report." />}</section>
      <section className="admin-card admin-duplicates"><PanelHeader eyebrow="Possible matches" title="Duplicate Review" />{report.possibleDuplicates?.length ? <div className="admin-duplicate-list">{report.possibleDuplicates.map((item) => <Link to={`/admin/reports/${encodeURIComponent(item.id)}`} key={item.id}><span><strong>{item.id}</strong><small>{item.category} · {item.submittedAt}</small></span><em>Possible match</em></Link>)}</div> : <DataState result={{ available: true }} icon="layers" empty="No possible duplicate information was returned." />}</section>
      <section className="admin-card admin-assignment-workspace"><PanelHeader eyebrow="Verified report routing" title="Referral and Severity" />{assignable ? <div className="admin-assignment-form"><dl><div><dt>Incident</dt><dd>{report.title || report.category}</dd></div><div><dt>Current agency</dt><dd>{report.assignedAgency || "Unassigned"}</dd></div></dl><label>Assigned agency<select value={agency} onChange={(event) => setAgency(event.target.value)}><option value="">Keep current agency</option>{["Barangay", "LGU", "Police", "Unassigned"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">Keep current severity</option>{["Low", "Medium", "High", "Critical"].map((item) => <option key={item}>{item}</option>)}</select></label><button className="button" disabled={(!agency && !severity) || actionLoading} onClick={() => setConfirmation({ type: "assignment", label: "Update Incident" })}>Update Incident</button></div> : <DataState result={{ available: true }} icon="layers" empty="Referral becomes available after an incident is verified." />}</section>
      <section className="admin-card admin-lifecycle"><PanelHeader eyebrow="Full report lifecycle" title="Monitoring Timeline" /><AdminTimeline report={report} />{report.status === "Rejected" && <p className="admin-alternate-path"><Icon name="priority" size={14} /> Review concluded: report rejected.</p>}</section>
    </div>
    <ConfirmationDialog open={Boolean(confirmation)} title={confirmation?.type === "assignment" ? "Confirm incident update" : "Confirm review decision"} message="This change will be recorded in the incident history and audit log." confirmLabel={confirmation?.label || "Confirm"} danger={decision === "Rejected"} onCancel={() => setConfirmation(null)} onConfirm={executeAction} />
  </AdminShell>;
}

export function AdminAssignmentsPage() {
  const { user } = useAuth();
  const result = useAdminReports(user);
  return <AdminShell title="Assignments" eyebrow="Agency referral and response monitoring"><PageHeading eyebrow="Assignment management" title="Refer verified reports and monitor response">Assignment and referral remain separate from the incident status defined by the backend.</PageHeading><div className="admin-section-tabs" aria-label="Assignment groups">{["Verified", "In Progress", "Resolved", "Closed"].map((item) => <span key={item}>{item}</span>)}</div><ReportList result={result} /></AdminShell>;
}

export function AdminLguPage() {
  const { user } = useAuth();
  const result = getAdminLgus(user);
  const lgus = result.data || [];
  return <AdminShell title="LGU Directory" eyebrow="Province-wide response partners"><PageHeading eyebrow="Routing directory" title="Pangasinan LGU offices and accounts">View authorized LGU availability and workload information used for report assignment.</PageHeading><section className="admin-card">{!result.available || result.status === "error" ? <DataState result={result} icon="shield" unavailable="The LGU directory is unavailable until its Administrator API is connected." error="We couldn't load the LGU directory." /> : lgus.length ? <div className="admin-directory-grid">{lgus.map((lgu) => <article key={lgu.id}><span><Icon name="shield" /></span><div><strong>{lgu.name || lgu.municipality}</strong><small>{lgu.accountStatus || "Status unavailable"}</small></div><dl><div><dt>Assigned</dt><dd>{lgu.assignedIncidents ?? dash}</dd></div><div><dt>Active</dt><dd>{lgu.activeResponses ?? dash}</dd></div></dl></article>)}</div> : <DataState result={{ available: true }} icon="shield" empty="No LGU offices were returned." />}</section></AdminShell>;
}

export function AdminPersonnelPage() {
  const { user } = useAuth();
  const result = useAdminPersonnel(user);
  const personnel = result.data || [];
  const [approving, setApproving] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const approve = async (id) => {
    setApproving(id); setApprovalError("");
    try { await approveAdminPersonnel(id); result.retry(); }
    catch (error) { setApprovalError(error?.message || "SafeLink couldn't approve this account."); }
    finally { setApproving(""); }
  };
  return <AdminShell title="Personnel Approval" eyebrow="Verified responder accounts"><PageHeading eyebrow="Account governance" title="Review personnel requests">Approve authorized Barangay, LGU, and Police personnel only when identity and jurisdiction details are valid.</PageHeading>{approvalError && <p className="form-error" role="alert">{approvalError}</p>}<section className="admin-card">{result.status === "loading" || result.status === "error" ? <DataState result={result} icon="users" unavailable="Personnel approval requests are unavailable." error="We couldn't load personnel requests." /> : personnel.length ? <div className="admin-personnel-list">{personnel.map((person) => <article key={person.id}><span><Icon name="users" /></span><div><strong>{person.name}</strong><small>{person.requestedRole} · {person.locality || "Jurisdiction unavailable"}</small><p>{person.email || "Email unavailable"} · {person.requestedAt || "Request date unavailable"}</p></div><b className={statusClass(person.status)}>{person.status}</b><button className="button" disabled={approving === person.id} onClick={() => approve(person.id)}>{approving === person.id ? "Approving..." : "Approve Personnel"}</button></article>)}</div> : <DataState result={{ available: true }} icon="users" empty="No personnel approval requests are pending." />}</section></AdminShell>;
}

export function AdminMapPage() {
  const { user } = useAuth();
  const result = useAdminReports(user);
  const reports = result.data || [];
  const items = reports.filter((item) => Array.isArray(item.coords) || (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))).map((item) => ({ ...item, coords: item.coords || [Number(item.longitude), Number(item.latitude)], category: item.title || item.category || "Incident", color: item.color || "#08a2aa" }));
  return <AdminShell title="Pangasinan Safety Map" eyebrow="Province-wide incident visibility"><PageHeading eyebrow="Operational geography" title="Reports and LGU assignments across Pangasinan">Filter authorized incidents by locality, assignment, status, category, priority, and date.</PageHeading><section className="admin-card admin-map-page"><div className="admin-map-filters">{[["status", "All statuses"], ["category", "All categories"], ["priority", "All priorities"], ["municipality", "All Pangasinan"], ["LGU", "All assigned LGUs"], ["date", "Any date"]].map(([label, option]) => <select key={label} disabled={!result.available} aria-label={`Filter map by ${label}`}><option>{option}</option></select>)}</div><div className="admin-map-large"><SafeLinkMap mode="incidents" items={items} compact /></div>{(!result.available || result.status === "error") && <p className="admin-panel-note"><Icon name={result.status === "error" ? "priority" : "shield"} size={15} /> {result.status === "error" ? "We couldn't load report locations." : "Province-wide report markers are unavailable until the Administrator reports API is connected. No sample incidents are displayed."}</p>}</section></AdminShell>;
}

export function AdminNotificationsPage() {
  const { user } = useAuth();
  const result = useAdminNotifications(user);
  const notifications = result.data || [];
  const [notificationError, setNotificationError] = useState("");
  const markAllRead = async () => { try { setNotificationError(""); await notificationApi.markAllRead(); result.retry(); } catch (error) { setNotificationError(error?.message || "Unable to update notifications."); } };
  return <AdminShell title="Notifications" eyebrow="Province-wide operations inbox"><PageHeading eyebrow="Operational updates" title="Review, assignment, personnel, and response activity" action={notifications.some((item) => item.unread) ? <button className="button button-muted" onClick={markAllRead}>Mark all as read</button> : null}>Follow authorized platform events without exposing private citizen information.</PageHeading>{notificationError && <p className="form-error" role="alert">{notificationError}</p>}<section className="admin-card admin-notifications">{!result.available || result.status === "error" ? <DataState result={result} icon="bell" unavailable="Administrator notifications are unavailable." error="We couldn't load notifications." /> : notifications.length ? notifications.map((item) => {
    const target = item.reportId ? `/admin/reports/${encodeURIComponent(item.reportId)}` : item.personnelId ? "/admin/personnel" : "/admin/notifications";
    const icon = item.type === "resolved" ? "check" : item.type === "personnel" ? "users" : "bell";
    return <Link className={item.unread ? "is-unread" : ""} onClick={() => item.unread && notificationApi.markRead(item.id).catch(() => {})} to={target} key={item.id}><span><Icon name={icon} />{item.unread && <i />}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>{item.timestamp}</small></div></Link>;
  }) : <DataState result={{ available: true }} icon="bell" empty="There are no Administrator notifications right now." />}</section></AdminShell>;
}

export function AdminAuditLogsPage() {
  const { user } = useAuth();
  const result = useAuditLogs(user);
  const logs = result.data?.data || [];
  const actorName = (actor) => actor ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System" : "System";
  const formatTime = (value) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Time unavailable";
  return <AdminShell title="Audit Logs" eyebrow="Immutable operational history"><PageHeading eyebrow="Security and accountability" title="Administrator audit trail">Review backend-recorded authentication, account, and incident actions.</PageHeading><section className="admin-card">{result.status === "loading" || result.status === "error" ? <DataState result={result} icon="history" unavailable="Audit logs are unavailable." error="We couldn't load the audit trail." /> : logs.length ? <div className="admin-personnel-list">{logs.map((log) => <article key={log._id || log.id}><span><Icon name={log.outcome === "failure" ? "priority" : "history"} /></span><div><strong>{String(log.action || "Recorded action").replaceAll("_", " ")}</strong><small>{actorName(log.actor)} · {log.actor?.role || "system"}</small><p>{log.details?.message || log.reason || `Outcome: ${log.outcome || "recorded"}`} · {formatTime(log.createdAt)}</p></div><b className={statusClass(log.outcome || "recorded")}>{log.outcome || "recorded"}</b></article>)}</div> : <DataState result={{ available: true }} icon="history" empty="No audit records were returned." />}</section></AdminShell>;
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const result = getAdminUsers(user);
  const users = result.data || [];
  const [confirmation, setConfirmation] = useState(null);
  return <AdminShell title="Users" eyebrow="Account administration"><PageHeading eyebrow="Authorized management" title="SafeLink user accounts">View only the account information required for supported administrative actions.</PageHeading><section className="admin-card">{!result.available || result.status === "error" ? <DataState result={result} icon="users" unavailable="User management data is unavailable until the Administrator users API is connected." error="We couldn't load users." /> : users.length ? <div className="admin-user-list">{users.map((account) => <article key={account.id}><span><Icon name="users" /></span><div><strong>{account.name}</strong><small>{account.role} · {account.email || "Email unavailable"}</small></div><b className={statusClass(account.status)}>{account.status}</b><div>{adminCapabilities.userSuspension && <button onClick={() => setConfirmation({ action: "Suspend", account })}>Suspend</button>}{adminCapabilities.userDeletion && <button className="danger-link" onClick={() => setConfirmation({ action: "Delete", account })}>Delete</button>}</div></article>)}</div> : <DataState result={{ available: true }} icon="users" empty="No user records were returned." />}</section>{!adminCapabilities.users && <p className="admin-page-disclosure"><Icon name="shield" size={15} /> Suspend and delete controls are hidden until authenticated Administrator user-management APIs are connected.</p>}<ConfirmationDialog open={Boolean(confirmation)} title={`${confirmation?.action || "Manage"} user account`} message={`${confirmation?.action || "This action"} requires explicit confirmation and will only be submitted through the authorized API.`} confirmLabel={`${confirmation?.action || "Confirm"} User`} danger={confirmation?.action === "Delete"} onCancel={() => setConfirmation(null)} onConfirm={() => setConfirmation(null)} /></AdminShell>;
}

export function AdminProfilePage() {
  const { user } = useAuth();
  const name = user?.name || user?.fullName || "Administrator";
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <AdminShell title="Profile" eyebrow="Administrator account"><section className="admin-profile-hero"><div>{initials}</div><span><small>Authorized Administrator</small><h2>{name}</h2><p>{user?.jobTitle || "Administrator"}</p><b><Icon name="shield" size={14} /> {user?.isDevelopmentPreview ? "Display-only preview account" : user?.accountStatus || "Account status unavailable"}</b></span></section><div className="admin-profile-grid"><section className="admin-card"><PanelHeader eyebrow="Identity" title="Account information" /><dl><div><dt>Name</dt><dd>{name}</dd></div><div><dt>Role</dt><dd>{user?.jobTitle || "Administrator"}</dd></div><div><dt>Email</dt><dd>{user?.email || "Not available"}</dd></div><div><dt>Account status</dt><dd>{user?.accountStatus || (user?.isDevelopmentPreview ? "Development preview" : "Not available")}</dd></div></dl></section><section className="admin-card"><PanelHeader eyebrow="Authority" title="Operational scope" /><dl><div><dt>Coverage</dt><dd>Pangasinan province-wide</dd></div><div><dt>Workspace</dt><dd>Review, routing, approvals, and monitoring</dd></div></dl></section></div><p className="admin-page-disclosure"><Icon name="shield" size={15} /> Profile editing remains read-only until a supported Administrator profile API is connected.</p></AdminShell>;
}

export function AdminSettingsPage() {
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const signOut = () => { logout(); navigate("/login/admin", { replace: true }); };
  const sections = [["users", "Account", "Administrator identity and role details are managed by the approved account workflow."], ["shield", "Security", "Password and security changes require a supported authenticated endpoint."], ["bell", "Notifications", "Delivery preferences will appear when the API supports persistent settings."], ["shield", "Privacy", "Operational access should remain limited to information required for review and routing."]];
  return <AdminShell title="Settings" eyebrow="Account and workspace"><PageHeading eyebrow="Administrator controls" title="Account, security, notifications, privacy, and session">Unavailable settings are intentionally not represented as functional switches.</PageHeading><div className="admin-settings-grid">{sections.map(([icon, title, text]) => <section className="admin-card" key={title}><span><Icon name={icon} /></span><div><small>Administrator</small><h2>{title}</h2><p>{text}</p></div></section>)}<section className="admin-card is-session"><span><Icon name="arrow" /></span><div><small>Session</small><h2>Sign out</h2><p>End the current Administrator workspace session on this device.</p><button className="button danger-button" onClick={signOut}>Logout</button></div></section></div></AdminShell>;
}
