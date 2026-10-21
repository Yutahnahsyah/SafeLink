import { useEffect, useRef, useState } from 'react';
import { UserRound, ShieldCheck, LogOut, ChevronDown } from 'lucide-react';
import { Link, useRouter } from '../routing';
import { useAuth } from '../auth';
import { auditRoles } from './auditPresentation';
import LogoutConfirmDialog from './LogoutConfirmDialog';
import './AdminProfileMenu.css';

export default function AdminProfileMenu() {
  const { user, logout } = useAuth();
  const { pathname, navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const container = useRef(null), trigger = useRef(null), menu = useRef(null);
  const initialFocus = useRef(0);
  const name = user?.name || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator';
  const role = auditRoles[user?.role] || 'Administrator';
  const initials = name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('');
  const items = () => Array.from(menu.current?.querySelectorAll('[role="menuitem"]') || []);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    items()[initialFocus.current]?.focus();
    const outside = event => { if (!container.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const openAt = index => { initialFocus.current = index; setOpen(true); if (open) items()[index]?.focus(); };
  const onMenuKey = event => {
    if (event.key === 'Tab') { close(); return; }
    const controls = items(), index = controls.indexOf(document.activeElement);
    const next = { ArrowDown:(index + 1) % controls.length, ArrowUp:(index - 1 + controls.length) % controls.length, Home:0, End:controls.length - 1 };
    if (Object.hasOwn(next, event.key)) { event.preventDefault(); controls[next[event.key]]?.focus(); }
  };
  return <div className="profile-menu admin-profile-menu" ref={container}>
    <button type="button" ref={trigger} aria-label={`Administrator account menu for ${name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'admin-account-menu' : undefined}
      onClick={() => open ? close(true) : openAt(0)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openAt(event.key === 'ArrowUp' ? 2 : 0); }
      }}>
      <span className="user-avatar" aria-hidden="true">{initials}</span><span><strong>{name}</strong><small>{role}</small></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="admin-profile-dropdown" id="admin-account-menu" role="menu" aria-label="Administrator account" ref={menu} onKeyDown={onMenuKey}>
      <Link to="/admin/profile" role="menuitem" tabIndex={-1} onClick={() => close()}><UserRound size={18} aria-hidden="true" />My Profile</Link>
      <Link to="/admin/settings" role="menuitem" tabIndex={-1} onClick={() => close()}><ShieldCheck size={18} aria-hidden="true" />Settings</Link>
      <button type="button" role="menuitem" tabIndex={-1} className="admin-profile-signout" onClick={() => { close(); setLogoutConfirmOpen(true); }}><LogOut size={18} aria-hidden="true" />Sign Out</button>
    </div>}
    <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={() => { setLogoutConfirmOpen(false); logout(); navigate('/login', { replace:true }); }} />
  </div>;
}
