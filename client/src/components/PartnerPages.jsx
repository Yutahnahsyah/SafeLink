import { useCallback, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { useAuth } from "../auth";
import { useRouter } from "../routing";
import { analyticsApi, incidentApi, notificationApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";

const workspaces = {
  barangay: {
    eyebrow: "Barangay response workspace",
    title: "Barangay Personnel Dashboard",
    copy: "Authorized community-level incident response access.",
    note: "Incidents assigned to this verified account.",
    login: "/login/barangay",
  },
  police: {
    eyebrow: "Police partner workspace",
    title: "Police Response Dashboard",
    copy: "Authorized incident-response coordination through SafeLink.",
    note: "Incidents assigned to this verified account.",
    login: "/login/police",
  },
};

export default function PartnerDashboardPage({ portal }) {
  const config = workspaces[portal];
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const loadIncidents = useCallback(() => incidentApi.list(), [user?.id]);
  const loadNotifications = useCallback(async () => (await notificationApi.list({ page: 1, limit: 5 })).data, [user?.id]);
  const loadAnalytics = useCallback(() => analyticsApi.overview(), [user?.id]);
  const incidentsResult = useApiResource(loadIncidents, [user?.id], { enabled: Boolean(user?.id), initialData: [] });
  const notificationsResult = useApiResource(loadNotifications, [user?.id], { enabled: Boolean(user?.id), initialData: [] });
  const analyticsResult = useApiResource(loadAnalytics, [user?.id], { enabled: Boolean(user?.id), initialData: null });
  const [updating, setUpdating] = useState("");
  const advance = async (incident) => {
    const next = { Submitted: "Under Validation", "Under Validation": "Verified", Verified: "In Progress", "In Progress": "Resolved", Resolved: "Closed" }[incident.status];
    if (!next) return;
    setUpdating(incident.id);
    try { await incidentApi.process(incident.id, { status: next }); incidentsResult.retry(); }
    finally { setUpdating(""); }
  };
  const signOut = () => { logout(); navigate(config.login, { replace: true }); };
  return <div className={`partner-app partner-app--${portal}`}>
    <header className="partner-topbar"><BrandLogo href={`/${portal}/dashboard`} variant="dashboard" /><div><span>{config.eyebrow}</span><strong>{user?.name || user?.fullName || config.title}</strong></div><button onClick={signOut}><Icon name="arrow" size={15} /> Sign out</button></header>
    <main className="partner-content">
      <section className="partner-hero"><span><Icon name={portal === "barangay" ? "users" : "shield"} size={24} /></span><div><small>{config.eyebrow}</small><h1>{config.title}</h1><p>{config.copy}</p></div></section>
      <div className="partner-grid">
        <section><span><Icon name="report" /></span><div><small>Authorized queue</small><h2>Assigned incidents</h2><p>{config.note}</p>{incidentsResult.status === "loading" ? <p>Loading incidents...</p> : incidentsResult.status === "error" ? <button onClick={incidentsResult.retry}>Retry</button> : incidentsResult.data.length ? incidentsResult.data.slice(0, 5).map((incident) => <article key={incident.id}><strong>{incident.type}</strong><small>{incident.location} · {incident.status}</small>{["Submitted", "Under Validation", "Verified", "In Progress", "Resolved"].includes(incident.status) && <button disabled={updating === incident.id} onClick={() => advance(incident)}>{updating === incident.id ? "Updating..." : "Advance status"}</button>}</article>) : <p>No incidents are assigned to this account.</p>}</div></section>
        <section><span><Icon name="bell" /></span><div><small>Response updates</small><h2>Notifications</h2>{notificationsResult.status === "loading" ? <p>Loading notifications...</p> : notificationsResult.status === "error" ? <button onClick={notificationsResult.retry}>Retry</button> : notificationsResult.data.length ? notificationsResult.data.map((item) => <p key={item.id}><strong>{item.title}</strong><br />{item.message}</p>) : <p>No notifications yet.</p>}</div></section>
        <section><span><Icon name="chart" /></span><div><small>Authorized analytics</small><h2>Jurisdiction overview</h2>{analyticsResult.data ? <p>{analyticsResult.data.summary.totalReports} reports · {analyticsResult.data.summary.activeReports} active · {analyticsResult.data.summary.resolvedReports} resolved</p> : <p>{analyticsResult.status === "loading" ? "Loading analytics..." : "Analytics are unavailable."}</p>}</div></section>
      </div>
    </main>
  </div>;
}
