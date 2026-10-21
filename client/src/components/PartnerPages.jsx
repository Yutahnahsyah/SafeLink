import { SectionSkeleton, RefreshNotice } from './PageSkeletons';
import { useCallback, useEffect, useRef, useState } from "react";
import ChangePasswordForm from "./ChangePasswordForm";
import MfaSettingsCard from './MfaSettingsCard';
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";
import { useNotificationFeed } from "../services/NotificationProvider";
import { useAuth } from "../auth";
import { Link, useRouter } from "../routing";
import SafeLinkMap from "./maps/SafeLinkMap";
import { analyticsApi, incidentApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";
import "./PartnerPages.css";
import { communityIncidentColor } from '../services/communityIncidentMarkers';
import BarangayIncidents from './BarangayIncidents';
import LogoutConfirmDialog from './LogoutConfirmDialog';

const workspaces = {
  barangay: {
    eyebrow: "Barangay response workspace",
    title: "Barangay Dashboard",
    copy: "Authorized community-level incident response access.",
    note: "Reports in your Barangay, including cases waiting to be claimed.",
    login: "/login",
  },
  police: {
    eyebrow: "Police partner workspace",
    title: "Police Response Dashboard",
    copy: "Authorized incident-response coordination through SafeLink.",
    note: "Incidents assigned to this verified account.",
    login: "/login",
  },
};

const barangayMarkerColor = (category) => ({
  'Missing or vulnerable persons': '#7656a6',
  'Harassment or unsafe encounters': '#b84276',
  'People requiring assistance': '#397449',
  'People needing assistance during flooding': '#2469ae',
}[category] || communityIncidentColor(category));

const barangayNavigation = [
  ["Dashboard", "/barangay/dashboard", "chart"],
  ["My Incidents", "/barangay/incidents", "report"],
  ["Map View", "/barangay/map", "map"],
  ["Reports & Analytics", "/barangay/analytics", "priority"],
];

function BarangayNavigation({ pathname, user, signOut, title, eyebrow, jurisdiction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);
  const name = user?.name || user?.fullName || "Barangay Personnel";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => { setMenuOpen(false); setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen && !drawerOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") { setMenuOpen(false); setDrawerOpen(false); } };
    const closeOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [menuOpen, drawerOpen]);

  return <>
    <aside className={`barangay-sidebar${drawerOpen ? " is-open" : ""}`} id="barangay-navigation">
      <div className="barangay-sidebar-brand"><BrandLogo href="/barangay/dashboard" variant="dashboard" /></div>
      <div className="barangay-workspace-label"><span>Barangay Operations</span><small>{jurisdiction || "Assigned jurisdiction"}</small></div>
      <nav aria-label="Barangay workspace">
        {barangayNavigation.map(([label, path, icon]) => <Link key={path} to={path} className={`barangay-nav-link${pathname === path || (path.endsWith("incidents") && pathname.startsWith(path + "/")) || (path.endsWith("dashboard") && pathname === "/barangay") ? " is-active" : ""}`} aria-current={pathname === path ? "page" : undefined} onClick={() => setDrawerOpen(false)}><Icon name={icon} size={20} /><span>{label}</span></Link>)}
      </nav>
    </aside>
    {drawerOpen && <button className="barangay-drawer-backdrop" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
    <header className="barangay-header">
      <button className="barangay-menu-toggle" type="button" aria-label={drawerOpen ? "Close navigation" : "Open navigation"} aria-expanded={drawerOpen} aria-controls="barangay-navigation" onClick={() => setDrawerOpen((open) => !open)}><Icon name={drawerOpen ? "close" : "menu"} size={22} /></button>
      <div className="barangay-header-title"><span>{eyebrow}</span><h1>{title}</h1></div>
      <NotificationBell />
      <div className="barangay-account" ref={menuRef}>
        <button className="barangay-account-trigger" type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="barangay-account-menu" onClick={() => setMenuOpen((open) => !open)}><span className="barangay-avatar">{initials}</span><span className="barangay-account-copy"><strong>{name}</strong><small>Barangay Personnel</small></span><span className="barangay-chevron" aria-hidden="true">⌄</span></button>
        <div id="barangay-account-menu" className={`barangay-account-menu${menuOpen ? " is-open" : ""}`} role="menu" aria-label="Account" aria-hidden={!menuOpen}>
          <Link to="/barangay/profile" role="menuitem" tabIndex={menuOpen ? 0 : -1}><Icon name="users" size={17} /> My Profile</Link>
          <Link to="/barangay/settings" role="menuitem" tabIndex={menuOpen ? 0 : -1}><Icon name="shield" size={17} /> Account Settings</Link>
          <button type="button" role="menuitem" tabIndex={menuOpen ? 0 : -1} onClick={() => { setMenuOpen(false); signOut(); }}><Icon name="arrow" size={17} /> Sign Out</button>
        </div>
      </div>
    </header>
  </>;
}

function Breakdown({ title, values = {}, description }) {
  const entries = Object.entries(values).filter(([, count]) => Number.isFinite(count) && count > 0);
  const maximum = Math.max(1, ...entries.map(([, count]) => count));
  return <section className="barangay-chart"><h3>{title}</h3>{description && <p>{description}</p>}{entries.length ? <ul>{entries.map(([label, count]) => <li key={label}><div><span>{label}</span><strong>{count}</strong></div><span className="barangay-chart-track" aria-hidden="true"><span style={{ width: `${count / maximum * 100}%` }} /></span></li>)}</ul> : <p>No recorded data available yet.</p>}</section>;
}

function resolutionMonths(reports = []) {
  const months = {};
  for (const report of reports) for (const entry of report.responseHistory || []) {
    if (entry.eventType !== 'status_changed' || (entry.newStatus || entry.status) !== 'Resolved') continue;
    const date = new Date(entry.timestamp);
    if (!Number.isFinite(date.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(date);
    const key = `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`;
    months[key] = (months[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12));
}

export default function PartnerDashboardPage({ portal, view = "dashboard", id }) {
  const config = workspaces[portal];
  const { user, logout } = useAuth();
  const { navigate, pathname } = useRouter();
  const loadIncidents = useCallback(() => incidentApi.list(), [user?.id]);
  const loadAnalytics = useCallback(() => analyticsApi.overview(), [user?.id]);
  const incidentsResult = useApiResource(loadIncidents, [user?.id, id], { enabled: Boolean(user?.id) && ["dashboard", "incidents", "map", "details", "analytics"].includes(view), initialData: [], live: ['incidents'] });
  const notificationsResult = useNotificationFeed();
  const analyticsResult = useApiResource(loadAnalytics, [user?.id], { enabled: Boolean(user?.id) && ["dashboard", "analytics"].includes(view), initialData: null, live: ['analytics'] });
  const notifications = notificationsResult.data.slice(0, 5);
  const [updating, setUpdating] = useState("");
  const [processError, setProcessError] = useState("");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const advance = async (incident) => {
    const next = {
      Verified: { status: "In Progress", remarks: "Response started." },
      "In Progress": { status: "Resolved", remarks: "Response completed." },
    }[incident.status];
    if (!next) return;
    setUpdating(incident.id);
    setProcessError("");
    try { await incidentApi.process(incident.id, next); incidentsResult.retry(); }
    catch (error) { setProcessError(error?.message || "SafeLink couldn't update this incident. Please try again."); }
    finally { setUpdating(""); }
  };
  const requestSignOut = () => setLogoutConfirmOpen(true);
  const signOut = () => { setLogoutConfirmOpen(false); logout(); navigate(config.login, { replace: true }); };
  const isBarangay = portal === "barangay";
  const pageInfo = {
    dashboard: [config.title, config.copy, "users"],
    incidents: ["My Incidents", config.note, "report"],
    details: ["Incident Details", "Review the report, record your response and follow the authorized handling workflow.", "report"],
    map: ["Map View", "Locations of incidents available to your Barangay account.", "map"],
    analytics: ["Reports & Analytics", "Incident totals for your authorized jurisdiction.", "chart"],
    profile: ["My Profile", "Your SafeLink personnel account information.", "users"],
    settings: ["Account Settings", "Account access and session controls.", "shield"],
  }[view] || [config.title, config.copy, "users"];
  const mapItems = (incidentsResult.data || []).filter((item) => Array.isArray(item.coords) && item.coords.every(Number.isFinite)).map((item) => ({ ...item, location: [item.barangay, item.municipality].filter(Boolean).join(", "), time: item.submittedAt, color: barangayMarkerColor(item.category) }));
  const jurisdiction = [user?.jurisdiction?.barangay, user?.jurisdiction?.municipalityOrCity].filter(Boolean).join(", ");
  const mapFocus = mapItems.length ? {
    center: [mapItems.reduce((sum, item) => sum + item.coords[1], 0) / mapItems.length, mapItems.reduce((sum, item) => sum + item.coords[0], 0) / mapItems.length],
    zoom: 12,
    label: jurisdiction || "Barangay jurisdiction",
  } : undefined;
  return <div className={`partner-app partner-app--${portal}${isBarangay && ["dashboard", "incidents", "details"].includes(view) ? " partner-app--readable" : ""}`}>
    {isBarangay ? <BarangayNavigation pathname={pathname} user={user} signOut={requestSignOut} title={pageInfo[0]} eyebrow={jurisdiction || "Assigned Barangay workspace"} jurisdiction={jurisdiction} /> : <header className="partner-topbar"><BrandLogo href={`/${portal}/dashboard`} variant="dashboard" /><div><span>{config.eyebrow}</span><strong>{user?.name || user?.fullName || config.title}</strong></div><NotificationBell /><Link to="/police/settings">Account Settings</Link><button onClick={requestSignOut}><Icon name="arrow" size={15} /> Sign out</button></header>}
    <main className="partner-content"><RefreshNotice result={incidentsResult} /><RefreshNotice result={notificationsResult} /><RefreshNotice result={analyticsResult} />
      {processError && <p className="form-error" role="alert">{processError}</p>}
      <section className={`partner-hero${isBarangay ? " barangay-workspace-heading" : ""}`}><span><Icon name={isBarangay ? pageInfo[2] : "shield"} size={24} /></span><div><small>{isBarangay ? jurisdiction || "Assigned Barangay workspace" : config.eyebrow}</small><h1>{pageInfo[0]}</h1><p>{isBarangay ? pageInfo[1] : config.copy}</p></div></section>
      {view === "map" && <section className="barangay-view-card"><h2>Incident locations</h2>{incidentsResult.status === "loading" ? <SectionSkeleton variant="map" label="Loading authorized incident map" /> : incidentsResult.status === "error" ? <button type="button" onClick={incidentsResult.retry}>Retry loading incidents</button> : <><p>{mapItems.length ? `${mapItems.length} mapped incidents in your authorized queue.` : "No incident locations are available in your authorized queue."}</p><ul className="barangay-map-legend" aria-label="Incident categories">{[...new Set(mapItems.map((item) => item.category))].map((category) => <li key={category}><span style={{ background: barangayMarkerColor(category) }} />{category}</li>)}</ul><div className="barangay-map"><SafeLinkMap mode="incidents" items={mapItems} focusView={mapFocus} /></div></>}</section>}
      {view === "analytics" && <section className="barangay-view-card"><h2>Jurisdiction overview</h2><p>All reports in {jurisdiction || 'your assigned jurisdiction'}. These totals include reports assigned to other personnel.</p>{analyticsResult.status === "loading" ? <SectionSkeleton variant="chart" label="Loading jurisdiction analytics" /> : analyticsResult.status === "error" ? <><p role="alert">Analytics could not be loaded.</p><button type="button" onClick={analyticsResult.retry}>Retry</button></> : analyticsResult.data ? <>
        <div className="barangay-stats">{[["Total reports", analyticsResult.data.summary.totalReports], ["Active reports", analyticsResult.data.summary.activeReports], ["Resolved / Closed", analyticsResult.data.summary.resolvedReports], ["Rejected reports", analyticsResult.data.summary.rejectedReports]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value ?? 0}</strong></div>)}</div>
        <div className="barangay-analytics-grid"><Breakdown title="Reports by category" values={analyticsResult.data.breakdowns?.incidentType} /><Breakdown title="Current status" values={analyticsResult.data.breakdowns?.status} /><Breakdown title="Recorded priority" values={analyticsResult.data.breakdowns?.severity} description="Stored severity includes reports awaiting official priority confirmation. Citizen-suggested urgency is separate." /><Breakdown title="Reporting trend" values={Object.fromEntries((analyticsResult.data.dailyTrend || []).slice(-14).map((item) => [item.date, item.count]))} description="Latest 14 reporting dates, in Philippine time. Dates without submissions are omitted." /></div>
        <h3>Resolution activity in your accessible reports</h3><p>Resolution submissions from your accessible queue, including supporting assignments. A reopened report can have more than one resolution event. This is a narrower scope than the jurisdiction totals above.</p>
        {incidentsResult.status === 'loading' ? <p>Loading resolution history...</p> : incidentsResult.status === 'error' ? <button onClick={incidentsResult.retry}>Retry resolution history</button> : <Breakdown title="Resolution submissions by month" values={resolutionMonths(incidentsResult.data)} />}
      </> : <p>No analytics are available yet.</p>}</section>}
      {view === "profile" && <section className="barangay-view-card"><h2>Personnel information</h2><dl className="barangay-account-details">{[["Name", user?.name || user?.fullName], ["Email", user?.email], ["Role", isBarangay ? "Barangay Personnel" : "Police Personnel"], ["Jurisdiction", jurisdiction], ["Account status", user?.accountStatus]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not available"}</dd></div>)}</dl></section>}
      {view === "settings" && <ChangePasswordForm />}
      {view === "settings" && <MfaSettingsCard />}
      {view === "settings" && <section className="barangay-view-card"><h2>Account settings</h2><p>Your account details and permissions are managed by SafeLink administrators. Profile changes are not available from this workspace.</p><div className="barangay-settings-action"><div><strong>Current session</strong><p>End your session on this device.</p></div><button type="button" onClick={requestSignOut}>Sign Out</button></div></section>}
      {isBarangay && ['dashboard', 'incidents', 'details'].includes(view) && <BarangayIncidents key={id || view} view={view} id={id} result={incidentsResult} user={user} notifications={notificationsResult} />}
      {!isBarangay && (view === "dashboard" || view === "incidents") && <div className={`partner-grid${view === "incidents" ? " partner-grid--incidents" : ""}`}>
        <section><span><Icon name="report" /></span><div><small>Authorized queue</small><h2>Assigned incidents</h2><p>{config.note}</p>{incidentsResult.status === "loading" ? <SectionSkeleton variant="table" rows={4} columns={4} label="Loading authorized incidents" /> : incidentsResult.status === "error" ? <button onClick={incidentsResult.retry}>Retry</button> : incidentsResult.data.length ? (view === "incidents" ? incidentsResult.data : incidentsResult.data.slice(0, 5)).map((incident) => {
          return <article key={incident.id}><strong>{incident.type}</strong><small>{incident.location} · {incident.status}</small>{["Verified", "In Progress"].includes(incident.status) && <button disabled={updating === incident.id} onClick={() => advance(incident)}>{updating === incident.id ? "Updating..." : "Advance status"}</button>}</article>;
        }) : <p>No incidents are assigned to this account.</p>}</div></section>
        {view === "dashboard" && <>
        <section><span><Icon name="bell" /></span><div><small>Response updates</small><h2>Notifications</h2>{notificationsResult.status === "loading" ? <SectionSkeleton variant="list" label="Loading response updates" /> : notificationsResult.status === "error" ? <button onClick={notificationsResult.retry}>Retry</button> : notifications.length ? notifications.map((item) => <p key={item.id}><strong>{item.priority !== "normal" ? `${item.priority.toUpperCase()} · ` : ""}{item.title}</strong><br />{item.message}</p>) : <p>No notifications yet.</p>}</div></section>
        <section><span><Icon name="chart" /></span><div><small>Authorized analytics</small><h2>Jurisdiction overview</h2>{analyticsResult.data ? <p>{analyticsResult.data.summary.totalReports} reports · {analyticsResult.data.summary.activeReports} active · {analyticsResult.data.summary.resolvedReports} resolved</p> : analyticsResult.status === "loading" ? <SectionSkeleton variant="chart" label="Loading incident analytics" /> : <p>Analytics are unavailable.</p>}</div></section>
        </>}
      </div>}
    </main>
    <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={signOut} />
  </div>;
}
