import { useReveal } from "./components/Sections";
import ClickSpark from "./components/ClickSpark";
import { brandColors } from "./branding";
import { dashboardForRole, protectedDestination, roleForPath } from "./services/authPolicy";
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
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./components/AuthPages";
import PartnerDashboardPage from "./components/PartnerPages";
import CommunityMapPublicationPage from "./components/CommunityMapPublication";
import {
  CitizenMapPage,
  DashboardPage,
  MyReportsPage,
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
  LguPersonnelPage,
  LguProfilePage,
  LguResolvedPage,
  LguSettingsPage,
} from "./components/LguPages";
import {
  AdminIncidentOperationsNoticePage,
  AdminProfilePage,
} from "./components/AdminPages";
import { GovernancePage, AccountsPage, PersonnelPage, IncidentAnalyticsPage, AuditPage } from "./components/AdminWorkspaces";
import AdminChangePasswordPage from "./components/AdminChangePasswordPage";
import "./App.css";
import { SessionLoader } from './components/PageSkeletons';
import { TermsPage, PrivacyPage } from './components/LegalPages';

const publicRoutes = {
  "/terms-and-conditions": TermsPage,
  "/privacy-policy": PrivacyPage,
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

function Routes() {
  const { pathname, search, navigate } = useRouter();
  const { isAuthenticated, isRestoring, restorationError, retryRestoration, logout, user } = useAuth();
  useReveal(pathname);
  const needsSession = Boolean(roleForPath(pathname)) || /^\/(app|login|register|activate-account|verify-email|forgot-password|reset-password)(\/|$)/.test(pathname);
  if (needsSession && !isAuthenticated && isRestoring) return <SessionLoader />;
  if (needsSession && !isAuthenticated && restorationError) return <SessionLoader error={restorationError} onRetry={retryRestoration} onSignIn={() => { logout(); navigate('/login', { replace: true }); }} />;
  const destination = protectedDestination(pathname, user, isAuthenticated);
  if (destination) return <Redirect to={destination} />;
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
    if (pathname.startsWith("/login/") && ["citizen", "barangay", "lgu", "police", "admin"].includes(pathname.split('/')[2])) return <Redirect to="/login" />;
    if (pathname === "/login") return <LoginPage />;
    const Page = publicRoutes[pathname];
    return <Page />;
  }
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const suffix = pathname.slice(4);
    const aliases = { "": "/citizen/dashboard", "/map": "/citizen/safety-map" };
    return <Redirect to={aliases[suffix] || `/citizen${suffix}`} />;
  }
  if (roleForPath(pathname) === 'citizen') {
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
    if (pathname === "/citizen/notifications") return <Redirect to="/citizen/dashboard?notifications=1" />;
    if (pathname === "/citizen/profile") return <ProfilePage />;
    if (pathname === "/citizen/settings") return <SettingsPage />;
    return <Redirect to="/citizen/dashboard" />;
  }
  if (roleForPath(pathname) === 'lgu_personnel') {
    if (pathname === "/lgu" || pathname === "/lgu/dashboard") return <LguDashboardPage />;
    if (pathname === "/lgu/incidents") return <LguIncidentsPage />;
    if (pathname.startsWith("/lgu/incidents/")) return <LguIncidentDetailPage id={decodeURIComponent(pathname.slice("/lgu/incidents/".length))} />;
    if (pathname === "/lgu/active-response") return <LguActiveResponsePage />;
    if (pathname === "/lgu/resolved") return <LguResolvedPage />;
    if (pathname === "/lgu/personnel") return <LguPersonnelPage />;
    if (pathname === "/lgu/map") return <LguMapPage />;
    if (pathname === "/lgu/notifications") return <Redirect to="/lgu/dashboard?notifications=1" />;
    if (pathname === "/lgu/profile") return <LguProfilePage />;
    if (pathname === "/lgu/settings") return <LguSettingsPage />;
    return <Redirect to="/lgu/dashboard" />;
  }
  if (roleForPath(pathname) === 'barangay_personnel') {
    if (pathname === "/barangay" || pathname === "/barangay/dashboard") return <PartnerDashboardPage portal="barangay" />;
    if (pathname === "/barangay/notifications") return <Redirect to="/barangay/dashboard?notifications=1" />;
    if (/^\/barangay\/incidents\/[^/]+$/.test(pathname)) return <PartnerDashboardPage portal="barangay" view="details" id={pathname.split('/').at(-1)} />;
    const barangayViews = { "/barangay/incidents": "incidents", "/barangay/map": "map", "/barangay/analytics": "analytics", "/barangay/profile": "profile", "/barangay/settings": "settings" };
    if (barangayViews[pathname]) return <PartnerDashboardPage portal="barangay" view={barangayViews[pathname]} />;
    return <Redirect to="/barangay/dashboard" />;
  }
  if (roleForPath(pathname) === 'police_personnel') {
    if (pathname === "/police" || pathname === "/police/dashboard") return <PartnerDashboardPage portal="police" />;
    if (pathname === "/police/notifications") return <Redirect to="/police/dashboard?notifications=1" />;
    if (pathname === "/police/settings") return <PartnerDashboardPage portal="police" view="settings" />;
    if (pathname === "/police/profile") return <PartnerDashboardPage portal="police" view="profile" />;
    return <Redirect to="/police/dashboard" />;
  }
  if (roleForPath(pathname) === 'admin') {
    if (pathname === "/admin" || pathname === "/admin/dashboard") return <GovernancePage />;
    if (pathname === "/admin/reports" || pathname.startsWith("/admin/reports/") || pathname === "/admin/review" || pathname === "/admin/assignments" || pathname === "/admin/lgu" || pathname === "/admin/map" || pathname === "/admin/notifications") return <AdminIncidentOperationsNoticePage />;
    if (pathname === "/admin/personnel") return <PersonnelPage />;
    if (pathname === "/admin/audit-logs") return <AuditPage />;
    if (pathname === "/admin/users") return <AccountsPage />;
    if (pathname === "/admin/incident-analytics") return <IncidentAnalyticsPage />;
    if (pathname === "/admin/community-map-publication") return <CommunityMapPublicationPage />;
    if (pathname === "/admin/profile") return <AdminProfilePage />;
    if (pathname === "/admin/change-password") return <AdminChangePasswordPage />;
    if (pathname === "/admin/settings") return <Redirect to="/admin/change-password" />;
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
