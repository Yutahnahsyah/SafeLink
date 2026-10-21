import AdminShell from './AdminShell';
import { useAuth } from '../auth';
import { useRouter } from '../routing';
import WorkspaceSettings from './WorkspaceSettings';

export default function AdminChangePasswordPage() {
  const { logout } = useAuth();
  const { navigate } = useRouter();
  return <AdminShell title="Settings" eyebrow="Account, privacy, and security">
    <section className="admin-password-page" aria-label="Administrator account settings"><WorkspaceSettings scope="Administrator" heading="Keep your administrator account secure and protected." privacy="Administrator access is recorded in audit history and limited to authorized SafeLink administration tasks." onSignOut={() => { logout(); navigate('/login', { replace: true }); }} /></section>
  </AdminShell>;
}
