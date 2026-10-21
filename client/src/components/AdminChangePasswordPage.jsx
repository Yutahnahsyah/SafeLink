import AdminShell from './AdminShell';
import ChangePasswordForm from './ChangePasswordForm';
import MfaSettingsCard from './MfaSettingsCard';

export default function AdminChangePasswordPage() {
  return <AdminShell title="Change Password" eyebrow="Administrator account">
    <section className="admin-password-page" aria-label="Administrator password security"><ChangePasswordForm /><MfaSettingsCard /></section>
  </AdminShell>;
}
