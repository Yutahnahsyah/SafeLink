// Public placeholders only. A URL or cached account is never proof of a role.
(() => {
  const root = document.getElementById('root');
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const protectedRoute = /^\/(citizen|app|barangay|lgu|police|admin)(\/|$)/.test(path);
  const page = protectedRoute ? 'session' : path === '/' ? 'landing' : /^\/login(\/|$)/.test(path) || /password|activate-account|verify-email/.test(path) ? 'login' : path === '/register' ? 'registration' : 'public';
  const block = (kind = '') => `<span class="sl-placeholder ${kind}" aria-hidden="true"></span>`;
  const lines = () => block('sl-line sl-wide') + block('sl-line') + block('sl-line sl-short');
  const form = () => `<div class="sl-loading-auth"><aside>${block('sl-title')}${lines()}</aside><section class="sl-loading-card">${block('sl-title')}${page === 'registration' ? `<div class="sl-loading-progress">${block()}${block()}${block()}</div>` : ''}${Array.from({ length: page === 'registration' ? 5 : 2 }, () => `<div class="sl-loading-field">${block('sl-line sl-short')}${block('sl-input')}</div>`).join('')}${block('sl-input')}</section></div>`;
  const content = page === 'session' ? '<div class="sl-session-mark" aria-hidden="true"></div><p>Checking your session…</p>'
    : page === 'landing' ? `<header class="sl-loading-nav">${block('sl-title')}${block('sl-line')}</header><div class="sl-loading-hero">${block('sl-title')}${lines()}${block('sl-input')}</div><div class="sl-loading-columns">${[1, 2, 3].map(() => `<section class="sl-loading-card">${lines()}</section>`).join('')}</div>`
    : page === 'login' || page === 'registration' ? form()
    : `<header class="sl-loading-nav">${block('sl-title')}</header><section class="sl-loading-card">${block('sl-title')}${lines()}</section>`;
  root.innerHTML = `<div class="sl-boot sl-boot--${page}" data-boot-loader data-loading-page="${page}" role="status" aria-label="${page === 'session' ? 'Preparing SafeLink session' : 'Loading ' + page + ' page'}" aria-busy="true">${content}</div>`;
  // A failed JavaScript download must not leave an endless skeleton.
  setTimeout(() => {
    if (!root.querySelector('[data-boot-loader]')) return;
    root.innerHTML = '<main class="sl-boot sl-boot--session" role="alert"><p>SafeLink is taking longer than expected to start. Check your connection and reload.</p><button type="button">Reload SafeLink</button></main>';
    root.querySelector('button').addEventListener('click', () => location.reload());
  }, 20000);
})();
