const dashboards = Object.freeze({
  citizen: '/citizen/dashboard', barangay_personnel: '/barangay/dashboard',
  lgu_personnel: '/lgu/dashboard', police_personnel: '/police/dashboard', admin: '/admin/dashboard',
});
const workspaces = Object.freeze({ citizen: 'citizen', barangay: 'barangay_personnel', lgu: 'lgu_personnel', police: 'police_personnel', admin: 'admin' });
export const dashboardForRole = (role) => Object.hasOwn(dashboards, role) ? dashboards[role] : '/login';
export const isVerifiedAccountShape = (user) => Boolean(typeof user?.id === 'string' && user.id && Object.hasOwn(dashboards, user.role));
export const roleForPath = (path) => {
  const segment = path.split('/')[1];
  return Object.hasOwn(workspaces, segment) ? workspaces[segment] : null;
};
export const shouldShowCitizenSessionReminder = (path, user) => (
  user?.role === 'citizen' && roleForPath(path) === 'citizen'
);
// Navigation only: backend middleware remains the authority for all data access.
export function protectedDestination(path, user, authenticated) {
  const requiredRole = roleForPath(path);
  if (!requiredRole) return null;
  if (!authenticated || !isVerifiedAccountShape(user)) return '/login';
  return user.role === requiredRole ? null : dashboardForRole(user.role);
}
