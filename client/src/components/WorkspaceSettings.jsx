import { useState } from "react";
import Icon from "./Icon";
import MfaSettingsCard from "./MfaSettingsCard";
import { ChangePasswordModal } from "./ChangePasswordForm";
import ChangeNameModal from "./ChangeNameModal";
import LogoutConfirmDialog from "./LogoutConfirmDialog";

export default function WorkspaceSettings({ scope, heading, privacy, onSignOut }) {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const sections = [
    ["users", "Profile", "Name & Identity", "Update the name shown across SafeLink and your authorized report history.", <button className="button button-muted" type="button" onClick={() => setNameModalOpen(true)}>Change name</button>],
    ["shield", "Security", "Account & Password", "Update your password securely from this account setting.", <button className="button button-muted" type="button" onClick={() => setPasswordModalOpen(true)}>Change password</button>],
    ["bell", "Updates", "Notification Preferences", `Preferences will appear here when the ${scope} notification service supports configurable delivery channels.`],
    ["users", "Privacy", "Data & Privacy", privacy],
  ];

  return <>
    <div className="settings-intro">
      <div><span>{scope} preferences</span><h2>{heading}</h2></div>
      <Icon name="shield" size={30} />
    </div>
    <div className="settings-grid">
      <MfaSettingsCard />
      {sections.map(([icon, eyebrow, title, description, action]) => <section className="citizen-card settings-card" key={title}>
        <span><Icon name={icon} /></span>
        <div><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p>{action && <div className="settings-card-actions">{action}</div>}</div>
      </section>)}
      <section className="citizen-card settings-card settings-card--logout">
        <span><Icon name="arrow" /></span>
        <div><small>Session</small><h2>Sign Out</h2><p>End your current SafeLink session on this device.</p><button className="button danger-button" type="button" onClick={() => setLogoutConfirmOpen(true)}>Logout</button></div>
      </section>
    </div>
    <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    <ChangeNameModal open={nameModalOpen} onClose={() => setNameModalOpen(false)} />
    <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={onSignOut} />
  </>;
}
