import GovernanceOverview from "./GovernanceOverview";
import AccountOverview from "./AccountOverview";
import AccountRecoveryAction from "./AccountRecoveryAction";
import "./AccountManagement.css";
import { SectionSkeleton, PageSkeleton, RefreshNotice } from './PageSkeletons';
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "./AdminShell";
import LguAccountManagement from "./LguAccountManagement";
import Icon from "./Icon";
import { RecentAuditEvents, AuditLogsView } from "./AuditMonitoring";
import { auditPresentation, auditTime, auditRoles } from "./auditPresentation";
import { useAuth } from "../auth";
import { Link, useRouter } from "../routing";
import { useApiResource } from "../services/useApiResource";
import { useAccountDirectory } from "../services/useAccountDirectory";
import { adminOverviewApi, auditApi, personnelApi } from "../services/safelinkApi";
import { useAuditLogs } from "../adminData";

const colors = ["#078f9b", "#1cc9c4", "#1980d1", "#68b5e8", "#8a6af0", "#f4a445", "#ef6677"];
const count = (value) => Number(value || 0).toLocaleString("en-PH");
const titleCase = (value) => String(value || "Unspecified").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const adminEnabled = (user) => Boolean(user?.id && user.role === "admin" && !user.isDevelopmentPreview);

function useAdminResource(user, load, dependencies = []) {
  const loader = useCallback(load, dependencies);
  return useApiResource(loader, dependencies, { enabled: adminEnabled(user) });
}

function WorkspaceTabs({ items, selected, onSelect }) {
  return <div className="av-tabs" role="tablist" aria-label="Workspace views">{items.map(([key, label, icon]) => <button key={key} type="button" role="tab" aria-selected={selected === key} onClick={() => onSelect(key)}><Icon name={icon} size={18} />{label}</button>)}</div>;
}

function Hero({ label, title, description, points = [] }) {
  return <section className="av-hero"><div className="av-hero-copy"><span className="av-kicker"><i />{label} workspace</span><h2>{title}</h2><p>{description}</p><div className="av-hero-points">{points.map(([icon, heading, detail]) => <div key={heading}><span><Icon name={icon} size={21} /></span><div><strong>{heading}</strong><small>{detail}</small></div></div>)}</div></div><div className="av-hero-art" aria-hidden="true"><span className="av-art-ring" /><span className="av-art-card av-art-back"><Icon name="chart" size={44} /></span><span className="av-art-card av-art-front"><Icon name="shield" size={64} /><i /><i /><i /></span><span className="av-art-caption">A safer, more connected community.</span></div></section>;
}

function AnimatedNumber({ value, loading }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === null || value === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
    const start = performance.now();
    let frame;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / 550);
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return value === null || value === undefined ? loading ? <span className="sl-placeholder" style={{ width: 60, height: 28 }} aria-hidden="true" /> : '—' : count(display);
}

function Kpis({ items, loading = false }) {
  return <div className="av-kpis">{items.map(([label, value, icon, tone]) => <article className={`av-kpi av-${tone || "teal"}`} key={label}><span className="av-icon"><Icon name={icon} size={24} /></span><div><small>{label}</small><strong><AnimatedNumber value={value} loading={loading} /></strong></div></article>)}</div>;
}

function Panel({ icon, title, description, action, children, className = "" }) {
  return <section className={`av-panel ${className}`}><header><span className="av-icon"><Icon name={icon} size={23} /></span><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{action && <div className="av-panel-action">{action}</div>}</header>{children}</section>;
}

function State({ result, empty = "No records available.", variant = 'table' }) {
  if (result?.status === "loading") return <SectionSkeleton variant={variant} rows={5} label="Loading account records" />;
  if (result?.status === "error") return <div className="av-state" role="alert"><Icon name="priority" /><strong>Could not load this information.</strong><p>{result.error?.message || "Please try again."}</p><button type="button" onClick={result.retry}>Retry</button></div>;
  if (result?.available === false) return <div className="av-state" role="status"><Icon name="shield" size={32} /><strong>Administrator sign-in required</strong><p>Sign in with a real administrator account to load live data.</p></div>;
  return <div className="av-state" role="status"><Icon name="users" size={32} /><strong>Nothing here yet</strong><p>{empty}</p></div>;
}

function Donut({ values = {}, centerLabel = "Total", labels = {} }) {
  const entries = Object.entries(values).filter(([, value]) => Number(value) > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <div className="av-chart-empty">No chart data for this period.</div>;
  let position = 0;
  const stops = entries.map(([, value], index) => { const start = position; position += value / total * 100; return `${colors[index % colors.length]} ${start}% ${position}%`; });
  return <div className="av-donut-wrap"><div className="av-donut" style={{ background: `conic-gradient(${stops.join(",")})` }} role="img" aria-label={entries.map(([name, value]) => `${labels[name] || titleCase(name)} ${value}`).join(", ")}><div><strong>{count(total)}</strong><small>{centerLabel}</small></div></div><ul className="av-legend">{entries.map(([name, value], index) => <li key={name}><i style={{ background: colors[index % colors.length] }} /><span>{labels[name] || titleCase(name)}</span><strong>{count(value)}</strong><small>{Math.round(value / total * 100)}%</small></li>)}</ul></div>;
}

function Bars({ values = {} }) {
  const entries = Object.entries(values).filter(([, value]) => Number(value) > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (!entries.length) return <div className="av-chart-empty">No chart data for this period.</div>;
  return <div className="av-bars">{entries.map(([name, value], index) => <div key={name}><span>{titleCase(name)}</span><div className="av-bar-track"><i style={{ width: `${value / max * 100}%`, background: colors[index % colors.length] }} /></div><strong>{count(value)}</strong></div>)}</div>;
}

function GovernancePage() { return <GovernanceOverview />; }

function RecentAccountActivity({ user }) {
  const result = useAuditLogs(user, { view: "recent", scope: "accounts", limit: 5 });
  const events = (result.data?.data || []).filter((event) => /^(AUTH_|PERSONNEL_|USER_|LGU_ACCOUNT_|LGU_PASSWORD_)/.test(event.action)).slice(0, 5);
  return <Panel icon="history" title="Recent Account Activity" description="The five latest account and authentication events." className="av-account-activity" action={<Link to="/admin/audit-logs">View all <Icon name="arrow" size={16} /></Link>}>
    {result.status !== "success" ? <State result={result} /> : events.length ? <div className="av-list">{events.map((event) => { const view = auditPresentation(event); return <div key={event._id}><span className="av-icon"><Icon name={view.icon} size={20} /></span><span><strong>{view.title}</strong><small>{view.actor}<span aria-hidden="true"> &middot; </span><time dateTime={event.createdAt}>{auditTime(event.createdAt)}</time></small></span></div>; })}</div> : <State empty="No account activity has been recorded yet." />}
  </Panel>;
}

function AccountPagination({ result, onPage }) {
  const pagination = result.data?.pagination;
  if (!pagination) return null;
  const { page, limit, total } = pagination;
  const totalPages = Math.max(1, pagination.totalPages);
  const busy = result.status !== "success" || result.refreshing;
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);
  return <nav className="av-pager av-account-pager" aria-label="User directory pagination" aria-busy={busy}>
    <span role="status" aria-live="polite">{busy ? "Updating users…" : `Showing ${count(start)}–${count(end)} of ${count(total)} users`}</span>
    <div>
      <button type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="av-page-number">Page {count(page)} of {count(totalPages)}</span>
      <button type="button" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  </nav>;
}

function AccountsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("directory");
  const [filters, setFilters] = useState({ search: "", role: "", status: "", verified: "" });
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [message, setMessage] = useState("");
  const result = useAccountDirectory(user, filters, page);
  const summary = result.data?.summary;
  const rows = result.data?.data || [];
  useEffect(() => {
    if (result.status === "success" && page > Math.max(1, result.data.pagination.totalPages)) {
      setPage(Math.max(1, result.data.pagination.totalPages));
    }
  }, [result.status, result.data, page]);
  const update = (name, value) => { setFilters((current) => ({ ...current, [name]: value })); setPage(1); };
  const changeStatus = async () => {
    if (!confirm) return;
    try { await personnelApi.setStatus(confirm._id, confirm.status === "suspended" ? "active" : "suspended"); setMessage("Account access updated."); result.retry(); }
    catch (error) { setMessage(error.message || "Could not update account access."); }
    setConfirm(null);
  };
  return <AdminShell title="Account Management" eyebrow="SafeLink administration"><div className="av-page av-page--accounts"><WorkspaceTabs items={[["directory", "User Directory", "users"], ["verification", "Verification", "shield"], ["access", "Access Control", "shield"]]} selected={tab} onSelect={(value) => { setTab(value); setPage(1); if (value !== "verification") setFilters((current) => ({ ...current, verified: "" })); }} /><Hero label="Accounts" title="Manage users. Protect access." description="Search all registered users, review verification, and manage suspension, reactivation, and personnel password recovery." points={[["shield", "Secure account access", "Apply existing authorization rules"], ["users", "Verified users", "See account status clearly"], ["history", "Account oversight", "Review authorized records"]]} /><Kpis loading={result.status === "loading"} items={[["Total users", summary?.total, "users", "blue"], ["Verified accounts", summary?.verified, "shield", "green"], ["Pending verification", summary?.pending, "track", "amber"], ["Suspended accounts", summary?.suspended, "priority", "red"]]} />{message && <p className="av-message" role="status">{message}</p>}{tab === "directory" || tab === "access" ? <div className="av-grid av-account-grid"><Panel icon="users" title={tab === "access" ? "Access Control" : "User Directory"} description="Citizens, Barangay, LGU, Police, and Admin accounts. Manage access here; edit official details in Personnel." className="av-main-panel"><div className="av-filters"><input aria-label="Search accounts" placeholder="Search name, email, or jurisdiction" maxLength={80} value={filters.search} onChange={(event) => update("search", event.target.value)} /><select aria-label="Filter by role" value={filters.role} onChange={(event) => update("role", event.target.value)}><option value="">All roles</option>{Object.entries(auditRoles).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><select aria-label="Filter by status" value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></div><RefreshNotice result={result} />{result.status !== "success" ? <State result={result} /> : rows.length ? <div className="av-table-scroll av-account-table" key={JSON.stringify([page, filters])}><table><thead><tr><th>Name</th><th>Role</th><th>Jurisdiction</th><th>Status</th><th>Verified</th><th>Account actions</th></tr></thead><tbody>{rows.map((account) => <tr key={account._id}><td data-label="Name"><strong>{account.firstName} {account.lastName}</strong><small>{account.email}</small></td><td data-label="Role">{auditRoles[account.role]}</td><td data-label="Jurisdiction">{account.jurisdiction?.municipalityOrCity || " "}</td><td data-label="Status"><span className={`av-badge is-${account.status}`}>{titleCase(account.status)}</span></td><td data-label="Verified">{account.isVerified ? "Verified" : "Pending"}</td><td data-label="Account actions"><div className="av-account-actions"><button type="button" disabled={account._id === user.id || !account.isVerified} onClick={() => setConfirm(account)}>{account.status === "suspended" ? "Reactivate" : "Suspend"}</button><AccountRecoveryAction account={account} /></div></td></tr>)}</tbody></table></div> : <State empty="No accounts match these filters." />}<AccountPagination result={result} onPage={setPage} /></Panel><aside className="av-account-insights" aria-label="Account insights"><Panel icon="chart" title="Role Distribution" description="All accounts by authorized role." className="av-role-distribution">{!summary ? result.status === "loading" ? <SectionSkeleton variant="chart" label="Loading role distribution" /> : <State result={result} variant="chart" /> : <Donut values={summary.roles} centerLabel="Users" labels={auditRoles} />}</Panel><AccountOverview result={result} /></aside></div> : <div className="av-grid av-account-grid"><Panel icon="shield" title="Verification Overview" description="Filter accounts awaiting verification." className="av-main-panel"><div className="av-filters"><select aria-label="Verification status" value={filters.verified} onChange={(event) => update("verified", event.target.value)}><option value="">All accounts</option><option value="false">Awaiting verification</option><option value="true">Verified</option></select></div>{result.status !== "success" ? <State result={result} /> : rows.length ? <div className="av-list">{rows.map((account) => <div key={account._id}><span className="av-initial">{account.firstName?.[0]}</span><span><strong>{account.firstName} {account.lastName}</strong><small>{auditRoles[account.role]}   {account.email}</small></span><span className={`av-badge is-${account.isVerified ? "active" : "pending"}`}>{account.isVerified ? "Verified" : "Pending"}</span></div>)}</div> : <State empty="No accounts match this verification filter." />}<AccountPagination result={result} onPage={setPage} /></Panel><Panel icon="history" title="Verification activity" description="Related account events are available in audit history."><p className="av-panel-copy">Administrator audit history records verification and approval events.</p><Link className="av-text-link" to="/admin/audit-logs">Open audit logs <Icon name="arrow" size={16} /></Link></Panel></div>}<RecentAccountActivity user={user} />{confirm && <div className="av-modal-backdrop"><div className="av-modal" role="alertdialog" aria-modal="true" aria-labelledby="av-confirm-title"><h3 id="av-confirm-title">{confirm.status === "suspended" ? "Reactivate" : "Suspend"} this account?</h3><p>{confirm.firstName} {confirm.lastName} will {confirm.status === "suspended" ? "regain" : "lose"} access through the existing account API.</p><div><button onClick={() => setConfirm(null)}>Cancel</button><button onClick={changeStatus}>Confirm</button></div></div></div>}</div></AdminShell>;
}

function PersonnelPage() {
  const { search: routeSearch } = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState("directory");
  const active = useAdminResource(user, () => personnelApi.active(), [user?.id]);
  const jurisdictions = useMemo(() => (active.data || []).reduce((map, person) => { const key = person.jurisdiction?.municipalityOrCity || "Unspecified"; map[key] = (map[key] || 0) + 1; return map; }, {}), [active.data]);
  return <AdminShell title="Personnel Management" eyebrow="SafeLink administration">
    <div className="av-page av-page--personnel">
      <Hero label="Personnel" title="Appoint officials. Define jurisdictions." description="Create authorized Barangay, LGU, and Police accounts and maintain their official details. Account access is managed in Accounts." points={[["shield", "Secure provisioning", "Admin-created official accounts"], ["users", "Official details", "Maintain personnel records"], ["pin", "Jurisdiction coverage", "Assign local responsibility"]]} />
      <WorkspaceTabs items={[["directory", "Directory", "users"], ["jurisdictions", "Jurisdictions", "pin"]]} selected={tab} onSelect={setTab} />
      <Kpis loading={active.status === "loading"} items={[["Active personnel", active.status === "success" ? active.data.length : null, "users", "blue"], ["Jurisdictions represented", active.status === "success" ? Object.keys(jurisdictions).length : null, "pin", "teal"]]} />
      {tab === "directory" ? <>
        <LguAccountManagement openCreateInitially={new URLSearchParams(routeSearch).get("create") === "1"} onSaved={() => active.retry()} />
      </> : <div className="av-grid av-personnel-grid">
        <Panel icon="pin" title="Jurisdiction Coverage" description="Active personnel grouped by municipality or city." className="av-main-panel">{active.status !== "success" ? <State result={active} /> : <Bars values={jurisdictions} />}</Panel>
        <Panel icon="chart" title="Personnel by Jurisdiction" description="Shares of the active responder directory.">{active.status !== "success" ? <State result={active} /> : <Donut values={jurisdictions} centerLabel="Personnel" />}</Panel>
      </div>}
    </div>
  </AdminShell>;
}

function Trend({ points = [] }) {
  const byDate = new Map(points.map((item) => [item.date, item.count]));
  const records = [];
  if (points.length) {
    const cursor = new Date(`${points[0].date}T00:00:00Z`);
    const end = new Date(`${points.at(-1).date}T00:00:00Z`);
    while (cursor <= end && records.length < 90) {
      const date = cursor.toISOString().slice(0, 10);
      records.push({ date, count: byDate.get(date) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  if (!records.length) return <div className="av-chart-empty">No incident submissions in this period.</div>;
  const max = Math.max(1, ...records.map((item) => item.count));
  const coords = records.map((item, index) => `${25 + index * 650 / Math.max(1, records.length - 1)},${150 - item.count / max * 120}`).join(" ");
  return <div className="av-trend"><svg viewBox="0 0 700 180" role="img" aria-label="Daily incident submission trend" preserveAspectRatio="none"><line x1="25" x2="675" y1="150" y2="150" stroke="#d9e6ea" /><line x1="25" x2="675" y1="90" y2="90" stroke="#edf2f4" /><line x1="25" x2="675" y1="30" y2="30" stroke="#edf2f4" /><polyline points={coords} fill="none" stroke="#11b8b8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{records.map((item, index) => <circle key={item.date} cx={25 + index * 650 / Math.max(1, records.length - 1)} cy={150 - item.count / max * 120} r="4" fill="#067e91"><title>{item.date}: {item.count}</title></circle>)}</svg><div><span>{records[0]?.date}</span><span>{records.at(-1)?.date}</span></div></div>;
}

function IncidentAnalyticsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(30);
  const result = useAdminResource(user, () => adminOverviewApi.incidents(days), [user?.id, days]);
  const data = result.data;
  const status = data?.breakdowns?.status || {};
  const kpis = [["Total incident reports", data?.summary?.total, "report", "blue"], ["Pending reviews", data ? (status.Submitted || 0) + (status["Under Barangay Review"] || 0) + (status["Under Validation"] || 0) : null, "track", "amber"], ["Active responses", data ? status["In Progress"] || 0 : null, "users", "teal"], ["Resolved incidents", data ? (status.Resolved || 0) + (status.Closed || 0) : null, "shield", "green"]];
  return <AdminShell title="Incident Analytics" eyebrow="SafeLink administration"><div className="av-page"><WorkspaceTabs items={[["overview", "Overview", "chart"], ["geography", "Geographic Trends", "pin"], ["response", "Response Performance", "track"]]} selected={tab} onSelect={setTab} /><Hero label="Analytics" title="Track incidents. Understand community trends." description="Read-only, province-wide summaries from actual incident records." points={[["eye", "Province-wide visibility", "Understand report activity"], ["chart", "Actionable trends", "See patterns over time"], ["report", "Response insights", "Monitor status outcomes"]]} /><div className="av-toolbar"><label>Reporting period <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><span>Counts include incidents submitted during the selected period.</span></div><Kpis loading={result.status === "loading"} items={kpis} /><RefreshNotice result={result} />{result.status === "loading" ? <PageSkeleton page="admin-analytics" label="Loading incident analytics" /> : result.status !== "success" ? <Panel icon="chart" title="Incident analytics"><State result={result} /></Panel> : tab === "overview" ? <div className="av-grid av-analytics-grid"><Panel icon="chart" title="Incident Trend" description="Daily submissions in Philippine time." className="av-main-panel"><Trend points={data.dailyTrend} /></Panel><Panel icon="report" title="Incidents by Category" description="Distribution of submitted incident types."><Donut values={data.breakdowns.category} centerLabel="Reports" /></Panel><Panel icon="pin" title="Municipality Overview" description="Top municipalities by submitted reports." className="av-main-panel"><MunicipalityTable rows={data.municipality} /></Panel><Panel icon="priority" title="Priority Distribution" description="Official incident severity."><Bars values={data.breakdowns.priority} /></Panel><Panel icon="layers" title="Status Breakdown" description="Current status of incidents in this period." className="av-wide-panel"><Bars values={data.breakdowns.status} /></Panel></div> : tab === "geography" ? <div className="av-grid av-analytics-grid"><Panel icon="pin" title="Municipality Trends" description="Ranked by report volume." className="av-main-panel"><MunicipalityTable rows={data.municipality} /></Panel><Panel icon="chart" title="Geographic Distribution" description="Top municipalities in this reporting period."><Donut values={Object.fromEntries(data.municipality.slice(0, 7).map((item) => [item.name, item.total]))} centerLabel="Reports" /></Panel></div> : <div className="av-grid av-analytics-grid"><Panel icon="layers" title="Response Status" description="Current state of submitted reports." className="av-main-panel"><Bars values={data.breakdowns.status} /></Panel><Panel icon="shield" title="Resolution Snapshot" description="Counts from recorded incident status."><Donut values={{ "In progress": status["In Progress"] || 0, Resolved: status.Resolved || 0, Closed: status.Closed || 0 }} centerLabel="Responses" /><p className="av-panel-copy">Response-time averages are unavailable because this summary does not measure first-response timestamps.</p></Panel></div>}</div></AdminShell>;
}

function MunicipalityTable({ rows = [] }) {
  return rows.length ? <div className="av-table-scroll"><table><thead><tr><th>Municipality or city</th><th>Reports</th><th>In progress</th><th>Resolved or closed</th></tr></thead><tbody>{rows.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{count(item.total)}</td><td>{count(item.active)}</td><td>{count(item.resolved)}</td></tr>)}</tbody></table></div> : <div className="av-chart-empty">No municipality data in this period.</div>;
}

function AuditActivityChart({ user }) {
  const result = useAuditLogs(user, { page: 1, limit: 100 });
  const values = (result.data?.data || []).reduce((map, event) => {
    const date = String(event.createdAt || "").slice(0, 10);
    if (date) map[date] = (map[date] || 0) + 1;
    return map;
  }, {});
  return <Panel icon="chart" title="Recent Event Volume" description="Latest 100 audit events grouped by UTC date.">
    {result.status !== "success" ? <State result={result} /> : <Bars values={values} />}
  </Panel>;
}

function AuditPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("activity");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const security = useAuditLogs(tab === "security" ? user : null, { page: 1, limit: 25, action: "AUTH_LOGIN", outcome: "failure" });
  const exportRecent = async () => {
    setExporting(true); setExportError("");
    try {
      const file = await auditApi.exportRecent();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a"); link.href = url; link.download = "safelink-audit-recent.csv"; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error.message || "Export could not be prepared."); }
    finally { setExporting(false); }
  };
  return <AdminShell title="Audit Logs" eyebrow="SafeLink administration"><div className="av-page"><WorkspaceTabs items={[["activity", "Activity Log", "report"], ["security", "Security Events", "shield"], ["exports", "Exports", "history"]]} selected={tab} onSelect={setTab} /><Hero label="Audit logs" title="Track every important action." description="Review backend-recorded activity, security events, and accountability records." points={[["shield", "Complete visibility", "Administrator-only audit access"], ["users", "Accountability", "Review actor and result"], ["history", "Reliable history", "Monitor recent events"]]} />{tab === "activity" ? <><AuditLogsView user={user} /><AuditActivityChart user={user} /></> : tab === "security" ? <div className="av-grid"><Panel icon="priority" title="Failed Sign-in Attempts" description="Recent failed authentication events. Automatically refreshes while visible." className="av-wide-panel">{security.status !== "success" ? <State result={security} /> : security.data.data.length ? <div className="av-list">{security.data.data.map((event) => { const view = auditPresentation(event); return <div key={event._id}><span className="av-icon av-red"><Icon name="priority" /></span><span><strong>{view.title}</strong><small>{view.actor}   {auditTime(event.createdAt)}</small></span><span className="av-badge is-suspended">Failed</span></div>; })}</div> : <State empty="No failed sign-in attempts match this view." />}</Panel></div> : <Panel icon="history" title="Export recent audit activity" description="Download the latest 100 authorized events as CSV."><div className="av-export"><p>This export is limited to the most recent 100 events. Use Activity Log filters to review older records.</p><button type="button" disabled={exporting || !adminEnabled(user)} onClick={exportRecent}>{exporting ? "Preparing " : "Download recent CSV"}</button>{exportError && <p role="alert">{exportError}</p>}</div></Panel>}</div></AdminShell>;
}

export { GovernancePage, AccountsPage, PersonnelPage, IncidentAnalyticsPage, AuditPage };
