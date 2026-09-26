import { useReveal } from "./components/Sections";
import ClickSpark from "./components/ClickSpark";
import { brandColors } from "./branding";
import { AuthProvider, useAuth } from "./auth";
import { Redirect, RouterProvider, useRouter } from "./routing";
import {
  AboutPage,
  FAQ,
  FeaturesPage,
  HomePage,
  HowPage,
  PublicMapPage,
  SafetyInfo,
} from "./components/PublicPages";
import {
  ForgotPasswordPage,
  LoginSelectorPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./components/AuthPages";
import PartnerDashboardPage from "./components/PartnerPages";
import {
  CitizenMapPage,
  DashboardPage,
  MyReportsPage,
  NotificationsPage,
  ProfilePage,
  ReportIncidentPage,
  SettingsPage,
  TrackReportPage,
} from "./components/CitizenPages";
import {
  LguActiveResponsePage,
  LguDashboardPage,
  LguIncidentDetailPage,
  LguIncidentsPage,
  LguMapPage,
  LguNotificationsPage,
  LguPersonnelPage,
  LguProfilePage,
  LguResolvedPage,
  LguSettingsPage,
} from "./components/LguPages";
import {
  AdminAssignmentsPage,
  AdminAuditLogsPage,
  AdminDashboardPage,
  AdminLguPage,
  AdminMapPage,
  AdminNotificationsPage,
  AdminPersonnelPage,
  AdminProfilePage,
  AdminReportDetailPage,
  AdminReportsPage,
  AdminReviewPage,
  AdminSettingsPage,
  AdminUsersPage,
} from "./components/AdminPages";
import "./App.css";

const publicRoutes = {
  "/": HomePage,
  "/about": AboutPage,
  "/how-it-works": HowPage,
  "/features": FeaturesPage,
  "/safety-map": PublicMapPage,
  "/safety": SafetyInfo,
  "/faq": FAQ,
  "/register": RegisterPage,
  "/activate-account": VerifyEmailPage,
  "/forgot-password": ForgotPasswordPage,
  "/reset-password": ResetPasswordPage,
};

const dashboardForRole = (role) => ({
  citizen: "/citizen/dashboard",
  barangay_personnel: "/barangay/dashboard",
  lgu_personnel: "/lgu/dashboard",
  police_personnel: "/police/dashboard",
  admin: "/admin/dashboard",
}[role] || "/login");

function Routes() {
  const { pathname, search } = useRouter();
  const { isAuthenticated, isRestoring, isAdminPreviewMode, isCitizenPreviewMode, isLguPreviewMode, user } = useAuth();
  useReveal(pathname);
  if (isRestoring) return <div className="route-pending" aria-label="Restoring SafeLink session"><span className="skeleton-block" /></div>;
  if (
    pathname === "/login" ||
    pathname === "/login/citizen" ||
    pathname === "/login/barangay" ||
    pathname === "/login/lgu" ||
    pathname === "/login/police" ||
    pathname === "/login/admin" ||
    pathname === "/register" ||
    pathname === "/activate-account" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    if (pathname === "/verify-email") return <Redirect to={`/activate-account${search || ""}`} />;
    if (isAuthenticated) return <Redirect to={dashboardForRole(user?.role)} />;
    if (pathname === "/login") return <LoginSelectorPage />;
    if (pathname === "/login/admin") return <LoginPage portal="admin" />;
    if (pathname === "/login/barangay") return <LoginPage portal="barangay" />;
    if (pathname === "/login/lgu") return <LoginPage portal="lgu" />;
    if (pathname === "/login/police") return <LoginPage portal="police" />;
    const Page = pathname === "/login/citizen" ? LoginPage : publicRoutes[pathname];
    return <Page />;
  }
  if (pathname.startsWith("/app")) {
    const suffix = pathname.slice(4);
    const aliases = { "": "/citizen/dashboard", "/map": "/citizen/safety-map" };
    return <Redirect to={aliases[suffix] || `/citizen${suffix}`} />;
  }
  if (pathname.startsWith("/citizen")) {
    if ((!isAuthenticated || user?.role !== "citizen") && !isCitizenPreviewMode)
      return <Redirect to="/login/citizen" />;
    if (pathname === "/citizen" || pathname === "/citizen/dashboard") return <DashboardPage />;
    if (pathname === "/citizen/report") return <ReportIncidentPage />;
    if (pathname === "/citizen/reports") return <MyReportsPage />;
    if (pathname.startsWith("/citizen/reports/"))
      return (
        <TrackReportPage
          id={decodeURIComponent(pathname.slice("/citizen/reports/".length))}
        />
      );
    if (pathname === "/citizen/safety-map") return <CitizenMapPage />;
    if (pathname === "/citizen/notifications") return <NotificationsPage />;
    if (pathname === "/citizen/profile") return <ProfilePage />;
    if (pathname === "/citizen/settings") return <SettingsPage />;
    return <Redirect to="/citizen/dashboard" />;
  }
  if (pathname.startsWith("/lgu")) {
    if ((!isAuthenticated || user?.role !== "lgu_personnel") && !isLguPreviewMode)
      return <Redirect to="/login/lgu" />;
    if (pathname === "/lgu" || pathname === "/lgu/dashboard") return <LguDashboardPage />;
    if (pathname === "/lgu/incidents") return <LguIncidentsPage />;
    if (pathname.startsWith("/lgu/incidents/")) return <LguIncidentDetailPage id={decodeURIComponent(pathname.slice("/lgu/incidents/".length))} />;
    if (pathname === "/lgu/active-response") return <LguActiveResponsePage />;
    if (pathname === "/lgu/resolved") return <LguResolvedPage />;
    if (pathname === "/lgu/personnel") return <LguPersonnelPage />;
    if (pathname === "/lgu/map") return <LguMapPage />;
    if (pathname === "/lgu/notifications") return <LguNotificationsPage />;
    if (pathname === "/lgu/profile") return <LguProfilePage />;
    if (pathname === "/lgu/settings") return <LguSettingsPage />;
    return <Redirect to="/lgu/dashboard" />;
  }
  if (pathname.startsWith("/barangay")) {
    if (!isAuthenticated || user?.role !== "barangay_personnel") return <Redirect to="/login/barangay" />;
    if (pathname === "/barangay" || pathname === "/barangay/dashboard") return <PartnerDashboardPage portal="barangay" />;
    return <Redirect to="/barangay/dashboard" />;
  }
  if (pathname.startsWith("/police")) {
    if (!isAuthenticated || user?.role !== "police_personnel") return <Redirect to="/login/police" />;
    if (pathname === "/police" || pathname === "/police/dashboard") return <PartnerDashboardPage portal="police" />;
    return <Redirect to="/police/dashboard" />;
  }
  if (pathname.startsWith("/admin")) {
    if ((!isAuthenticated || user?.role !== "admin") && !isAdminPreviewMode)
      return <Redirect to="/login/admin" />;
    if (pathname === "/admin" || pathname === "/admin/dashboard") return <AdminDashboardPage />;
    if (pathname === "/admin/reports") return <AdminReportsPage />;
    if (pathname.startsWith("/admin/reports/")) return <AdminReportDetailPage id={decodeURIComponent(pathname.slice("/admin/reports/".length))} />;
    if (pathname === "/admin/review") return <AdminReviewPage />;
    if (pathname === "/admin/assignments") return <AdminAssignmentsPage />;
    if (pathname === "/admin/lgu") return <AdminLguPage />;
    if (pathname === "/admin/personnel") return <AdminPersonnelPage />;
    if (pathname === "/admin/map") return <AdminMapPage />;
    if (pathname === "/admin/notifications") return <AdminNotificationsPage />;
    if (pathname === "/admin/audit-logs") return <AdminAuditLogsPage />;
    if (pathname === "/admin/users") return <AdminUsersPage />;
    if (pathname === "/admin/profile") return <AdminProfilePage />;
    if (pathname === "/admin/settings") return <AdminSettingsPage />;
    return <Redirect to="/admin/dashboard" />;
  }
  const Page = publicRoutes[pathname];
  return Page ? <Page /> : <Redirect to="/" />;
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <ClickSpark
          sparkColor={brandColors.teal}
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
        >
          <Routes />
        </ClickSpark>
      </AuthProvider>
    </RouterProvider>
  );
}
