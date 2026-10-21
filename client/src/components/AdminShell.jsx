import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import AdminProfileMenu from "./AdminProfileMenu";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import "./AdminModule.css";
import "./AdminRedesign.css";

const navigation = [
  ["/admin/dashboard", "chart", "Platform Governance"],
  ["/admin/users", "users", "Accounts"],
  ["/admin/personnel", "users", "Personnel"],
  ["/admin/incident-analytics", "chart", "Incident Analytics"],
  ["/admin/audit-logs", "history", "Audit Logs"],
];

export default function AdminShell({ title, eyebrow, children }) {
  const { pathname } = useRouter();
  const { isAdminPreviewMode } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const active = (href) => href === "/admin/dashboard"
    ? pathname === href || pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
  return <div className={`citizen-app admin-app${collapsed ? " is-collapsed" : ""}`}>
    <aside className={`citizen-sidebar admin-sidebar ${drawerOpen ? "is-open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo href="/admin/dashboard" variant="dashboard" /><button onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><Icon name="close" /></button></div>
      <div className="admin-workspace-label"><span>SafeLink</span><small>Administration</small></div>
      <nav aria-label="Administrator navigation">{navigation.map(([href, icon, label]) => <Link key={href} to={href} title={label} data-label={label} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}><span className="sidebar-nav-icon"><Icon name={icon} /></span><span>{label}</span></Link>)}</nav>
      <button className="av-collapse-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><Icon name="arrow" size={18} /><span>{collapsed ? "Expand menu" : "Collapse menu"}</span></button>
    </aside>
    {drawerOpen && <button className="sidebar-scrim" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />}
    <div className="citizen-main">
      <header className="citizen-topbar admin-topbar">
        <button className="sidebar-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
        <div className="admin-title-block"><span>{eyebrow || "Administrator"}</span><h1>{title}</h1></div>
        <div className="citizen-top-actions">
          {isAdminPreviewMode && <span className="preview-mode-badge admin-preview-badge" role="status">Development Preview</span>}
          <Link className="top-notification" to="/admin/audit-logs" aria-label="Administrator audit logs"><Icon name="history" /></Link>
          <AdminProfileMenu />
        </div>
      </header>
      <main className="citizen-content admin-content" key={pathname}>
        {pathname === "/admin/incident-analytics" && <Link className="admin-community-map-link" to="/admin/community-map-publication"><Icon name="map" size={17} /> Review community map approvals</Link>}
        {children}
      </main>
    </div>
  </div>;
}
