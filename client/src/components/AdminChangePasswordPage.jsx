import AdminShell from './AdminShell';
import ChangePasswordForm from './ChangePasswordForm';

export default function AdminChangePasswordPage() {
  return <AdminShell title="Change Password" eyebrow="Administrator account">
    <section className="admin-password-page" aria-label="Administrator password security"><ChangePasswordForm /></section>
  </AdminShell>;
}
