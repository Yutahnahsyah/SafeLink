import './PageSkeletons.css';
import { useEffect, useState } from 'react';

const Block = ({ kind = 'sl-line', ...props }) => <span className={`sl-placeholder ${kind}`} aria-hidden="true" {...props} />;

export function SessionLoader({ redirect = false, error, onRetry, onSignIn }) {
  const [stalled, setStalled] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setStalled(true), 20000); return () => clearTimeout(timer); }, []);
  return <div className="sl-session-loader" role={error ? 'alert' : 'status'} aria-label={error ? 'Session verification unavailable' : 'Checking session'} aria-busy={!error && !stalled}>{!error && !stalled && <div className="sl-session-mark" aria-hidden="true" />}<p>{error || (stalled ? 'SafeLink is taking longer than expected. Check your connection and reload.' : redirect ? 'Opening your page…' : 'Checking your session…')}</p>{error ? <div className="sl-session-actions"><button type="button" onClick={onRetry}>Try again</button><button type="button" onClick={onSignIn}>Go to sign in</button></div> : stalled && <button type="button" onClick={() => window.location.reload()}>Reload SafeLink</button>}</div>;
}

export function SkeletonTableRows({ rows = 5, columns = 8 }) {
  return Array.from({ length: rows }, (_, row) => <tr key={row} aria-hidden="true">{Array.from({ length: columns }, (_, cell) => <td key={cell}><Block /></td>)}</tr>);
}

export function SectionSkeleton({ variant = 'list', rows = 3, columns = 5, label = 'Loading content' }) {
  return <div className={`sl-section-skeleton sl-skeleton-${variant}`} role="status" aria-label={label} aria-busy="true" style={{ '--sl-columns': columns }}>
    {variant === 'table' ? Array.from({ length: rows + 1 }, (_, row) => <div key={row}>{Array.from({ length: columns }, (_, cell) => <Block key={cell} />)}</div>)
      : variant === 'metrics' ? Array.from({ length: 4 }, (_, index) => <div key={index}><Block /><Block kind="sl-title" /><Block kind="sl-line sl-short" /></div>)
      : variant === 'chart' ? Array.from({ length: 7 }, (_, index) => <Block key={index} />)
      : variant === 'map' ? <Block />
      : variant === 'form' ? <>{Array.from({ length: rows * 2 }, (_, index) => <div key={index}><Block kind="sl-line sl-short" /><Block kind="sl-input" /></div>)}<Block kind="sl-input" /></>
      : Array.from({ length: rows }, (_, index) => <div key={index}><Block kind="sl-avatar" /><div className="sl-copy"><Block /><Block kind="sl-line sl-short" /></div></div>)}
  </div>;
}

// Used only after authorization, inside a page's existing shell.
export function PageSkeleton({ page, label = 'Loading page content' }) {
  const card = (variant, key) => <section className="sl-loading-card" key={key}><Block kind="sl-title" /><SectionSkeleton variant={variant} rows={variant === 'table' ? 5 : 3} label={`${label}: ${variant}`} /></section>;
  if (page === 'report' || page === 'settings' || page === 'login' || page === 'registration') return <div className="sl-page-skeleton" data-loading-page={page}>{(page === 'report' || page === 'registration') && <div className="sl-loading-progress"><Block /><Block /><Block /></div>}{card('form', 'form')}{page === 'report' && <>{card('map', 'map')}<div className="sl-loading-card"><Block kind="sl-upload" /></div></>}</div>;
  // Match the panel arrangement, rather than adding the same metric/table/map
  // combination to every workspace. Pages also reuse SectionSkeleton in place.
  const layouts = {
    'citizen-dashboard': ['map', 'list', 'table', 'list'],
    'barangay-dashboard': ['table', 'list', 'chart'],
    'police-dashboard': ['table', 'list', 'chart'],
    'lgu-dashboard': ['map', 'list', 'list', 'list', 'list'],
    'admin-governance': ['list', 'list'],
    'admin-accounts': ['table', 'list'],
    'admin-personnel': ['table'],
    'admin-analytics': ['chart', 'chart', 'table', 'chart', 'chart'],
    'admin-audit': ['table', 'chart'],
  };
  const panels = layouts[page] || ['table'];
  return <div className="sl-page-skeleton" data-loading-page={page}>
    {['lgu-dashboard', 'admin-governance'].includes(page) && <SectionSkeleton variant="metrics" label={`${label}: summary`} />}
    <div className={`sl-loading-columns sl-loading-columns--${page}`}>{panels.map((variant, index) => card(variant, index))}</div>
  </div>;
}

export function ResourceError({ result, label = 'Could not load this information.' }) {
  return <div className="sl-resource-error" role="alert"><p>{label}</p><p>{result.error?.message}</p>{result.retry && <button type="button" onClick={result.retry}>Retry</button>}</div>;
}

export function RefreshNotice({ result }) {
  if (result?.refreshError) return <p className="sl-refresh-notice" role="alert">Refresh failed. Previously loaded information is shown. <button type="button" onClick={result.retry}>Retry</button></p>;
  return result?.refreshing ? <p className="sl-refresh-notice" role="status">Updating information…</p> : null;
}
