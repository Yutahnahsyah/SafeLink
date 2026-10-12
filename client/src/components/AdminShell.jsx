import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import "./AdminModule.css";

const navigation = [
  ["/admin/dashboard", "chart", "Dashboard"],
  ["/admin/personnel", "users", "Personnel"],
  ["/admin/audit-logs", "history", "Audit Logs"],
  ["/admin/users", "users", "Users"],
];

export default function AdminShell({ title, eyebrow, children }) {
  const { pathname, navigate } = useRouter();
  const { user, logout, isAdminPreviewMode } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const active = (href) => href === "/admin/dashboard"
    ? pathname === href || pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
  const name = user?.name || user?.fullName || "Administrator";
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const signOut = () => {
    logout();
    navigate("/login/admin", { replace: true });
  };

  return <div className="citizen-app admin-app">
    <aside className={`citizen-sidebar admin-sidebar ${drawerOpen ? "is-open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo href="/admin/dashboard" variant="dashboard" showName={false} /><button onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><Icon name="close" /></button></div>
      <div className="admin-workspace-label"><span>Platform Governance</span><small>Accounts and audit history</small></div>
      <nav aria-label="Administrator navigation">{navigation.map(([href, icon, label]) => <Link key={href} to={href} title={label} data-label={label} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}><span className="sidebar-nav-icon"><Icon name={icon} /></span><span>{label}</span></Link>)}</nav>
      <div className="sidebar-help admin-sidebar-note"><Icon name="layers" /><div><strong>Admin authority</strong><span>Maintain user access, approve personnel, and review audit records.</span></div></div>
    </aside>
    {drawerOpen && <button className="sidebar-scrim" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />}
    <div className="citizen-main">
      <header className="citizen-topbar admin-topbar">
        <button className="sidebar-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
        <div className="admin-title-block"><span>{eyebrow || "Administrator"}</span><h1>{title}</h1></div>
        <div className="admin-command-links"><span><Icon name="shield" size={14} /> Account governance</span><Link to="/admin/personnel">Personnel</Link><Link to="/admin/audit-logs">Audit logs</Link></div>
        <div className="citizen-top-actions">
          {isAdminPreviewMode && <span className="preview-mode-badge admin-preview-badge" role="status">Development Preview</span>}
          <Link className="top-notification" to="/admin/audit-logs" aria-label="Administrator audit logs"><Icon name="history" /></Link>
          <div className="profile-menu" ref={profileRef} onKeyDown={(event) => {
            if (event.key === "Escape" && profileOpen) { setProfileOpen(false); profileButtonRef.current?.focus(); }
          }}>
            <button ref={profileButtonRef} onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-haspopup="true" aria-controls="admin-account-menu">
              <span className="user-avatar">{initials}</span><span><strong>{name}</strong><small>{user?.jobTitle || "Administrator"}</small></span><Icon name="arrow" size={15} />
            </button>
            {profileOpen && <div className="profile-dropdown" id="admin-account-menu"><Link to="/admin/profile"><Icon name="users" /> Profile</Link><Link to="/admin/settings"><Icon name="shield" /> Settings</Link><button onClick={signOut}><Icon name="arrow" /> Logout</button></div>}
          </div>
        </div>
      </header>
      <main className="citizen-content admin-content" key={pathname}>{children}</main>
    </div>
  </div>;
}
