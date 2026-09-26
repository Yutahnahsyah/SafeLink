import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";

const items = [
  ["/citizen/dashboard", "chart", "Dashboard"],
  ["/citizen/report", "report", "Report Incident"],
  ["/citizen/reports", "history", "My Reports"],
  ["/citizen/safety-map", "map", "Safety Map"],
  ["/citizen/notifications", "bell", "Notifications"],
];

export default function CitizenShell({ title, eyebrow, children }) {
  const { pathname, navigate } = useRouter();
  const { user, logout, isPreviewMode } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const close = (e) => {
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const active = (href) =>
    href === "/citizen/dashboard" || href === "/citizen/report"
      ? pathname === href
      : pathname.startsWith(href);
  const doLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login/citizen", { replace: true });
  };
  return (
    <div className="citizen-app">
      <aside className={`citizen-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <BrandLogo href="/citizen/dashboard" variant="dashboard" />
          <button onClick={() => setOpen(false)} aria-label="Close navigation">
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Citizen navigation">
          {items.map(([href, icon, label]) => (
            <Link
              key={href}
              to={href}
              className={active(href) ? "active" : ""}
              aria-current={active(href) ? "page" : undefined}
            >
              <span className="sidebar-nav-icon"><Icon name={icon} /></span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-help">
          <Icon name="shield" />
          <div>
            <strong>Need urgent help?</strong>
            <span>Call emergency services at 911.</span>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="citizen-main">
        <header className="citizen-topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
          <div>
            <span>{eyebrow || "Citizen Portal"}</span>
            <h1>{title}</h1>
          </div>
          <div className="citizen-top-actions">
            {isPreviewMode && (
              <span className="preview-mode-badge" role="status">
                Development Preview
              </span>
            )}
            <Link
              className="top-notification"
              to="/citizen/notifications"
              aria-label="Notifications"
            >
              <Icon name="bell" />
            </Link>
            <div
              className="profile-menu"
              ref={profileRef}
              onKeyDown={(event) => {
                if (event.key === "Escape" && profileOpen) {
                  setProfileOpen(false);
                  profileButtonRef.current?.focus();
                }
              }}
            >
              <button
                ref={profileButtonRef}
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-controls="citizen-account-menu"
              >
                <span className="user-avatar">
                  {(user?.name || user?.fullName || "Citizen")
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <strong>{user?.name || user?.fullName || "Citizen"}</strong>
                  <small>Citizen</small>
                </span>
                <Icon name="arrow" size={15} />
              </button>
              {profileOpen && (
                <div className="profile-dropdown" id="citizen-account-menu">
                  <Link
                    to="/citizen/profile"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Icon name="users" /> Profile
                  </Link>
                  <Link
                    to="/citizen/settings"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Icon name="shield" /> Settings
                  </Link>
                  <button onClick={doLogout}>
                    <Icon name="arrow" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="citizen-content" key={pathname}>{children}</main>
      </div>
      <nav className="citizen-mobile-nav" aria-label="Citizen mobile navigation">
        {items.map(([href, icon, label]) => <Link key={href} to={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}><Icon name={icon} size={19} /><span>{label === "Report Incident" ? "Report" : label === "My Reports" ? "Reports" : label === "Safety Map" ? "Map" : label}</span></Link>)}
      </nav>
    </div>
  );
}
