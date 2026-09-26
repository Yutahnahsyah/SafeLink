import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import { getLguJurisdiction } from "../lguScope";
import "./LguModule.css";

const items = [
  ["/lgu/dashboard", "chart", "Dashboard"],
  ["/lgu/incidents", "report", "Assigned Incidents"],
  ["/lgu/active-response", "priority", "Active Response"],
  ["/lgu/resolved", "check", "Resolved"],
  ["/lgu/personnel", "users", "Personnel"],
  ["/lgu/map", "map", "Safety Map"],
  ["/lgu/notifications", "bell", "Notifications"],
];

export default function LguShell({ title, eyebrow, children }) {
  const { pathname, navigate } = useRouter();
  const { user, logout, isLguPreviewMode } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const active = (href) => href === "/lgu/dashboard"
    ? pathname === href || pathname === "/lgu"
    : pathname === href || pathname.startsWith(`${href}/`);
  const name = user?.name || user?.fullName || "LGU Personnel";
  const jurisdiction = getLguJurisdiction(user);
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const doLogout = () => {
    logout();
    navigate("/login/lgu", { replace: true });
  };

  return (
    <div className="citizen-app lgu-app">
      <aside className={`citizen-sidebar lgu-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandLogo href="/lgu/dashboard" variant="dashboard" />
          <button onClick={() => setOpen(false)} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <div className="lgu-workspace-label"><span>LGU Operations</span><small>{jurisdiction ? `${jurisdiction} jurisdiction` : "Assigned jurisdiction"}</small></div>
        <nav aria-label="LGU navigation">
          {items.map(([href, icon, label]) => (
            <Link key={href} to={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}>
              <span className="sidebar-nav-icon"><Icon name={icon} /></span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-help lgu-sidebar-note">
          <Icon name="shield" />
          <div><strong>Assignment authority</strong><span>Incidents are assigned and reassigned by SafeLink Admin.</span></div>
        </div>
      </aside>
      {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <div className="citizen-main">
        <header className="citizen-topbar lgu-topbar">
          <button className="sidebar-toggle" onClick={() => setOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div><span>{eyebrow || "LGU Operations"}</span><h1>{title}</h1></div>
          <div className="citizen-top-actions">
            {isLguPreviewMode && <span className="preview-mode-badge lgu-preview-badge" role="status">Development Preview</span>}
            <Link className="top-notification" to="/lgu/notifications" aria-label="LGU notifications"><Icon name="bell" /></Link>
            <div className="profile-menu" ref={profileRef} onKeyDown={(event) => {
              if (event.key === "Escape" && profileOpen) { setProfileOpen(false); profileButtonRef.current?.focus(); }
            }}>
              <button ref={profileButtonRef} onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-haspopup="true" aria-controls="lgu-account-menu">
                <span className="user-avatar">{initials}</span>
                <span><strong>{name}</strong><small>{jurisdiction ? `${jurisdiction} LGU` : user?.jobTitle || "LGU Personnel"}</small></span>
                <Icon name="arrow" size={15} />
              </button>
              {profileOpen && <div className="profile-dropdown" id="lgu-account-menu">
                <Link to="/lgu/profile"><Icon name="users" /> Profile</Link>
                <Link to="/lgu/settings"><Icon name="shield" /> Settings</Link>
                <button onClick={doLogout}><Icon name="arrow" /> Logout</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="citizen-content lgu-content" key={pathname}>{children}</main>
      </div>
    </div>
  );
}
