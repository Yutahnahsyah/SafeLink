import { useEffect, useRef, useState } from 'react';
import AdminShell from './AdminShell';
import Icon from './Icon';
import { Link } from '../routing';
import { useAuth } from '../auth';
import { adminOverviewApi } from '../services/safelinkApi';
import { startAuditPolling } from '../services/auditPolling';
import { RecentAuditEvents } from './AuditMonitoring';
import { auditRoles, auditTime } from './auditPresentation';
import './GovernanceOverview.css';
import { SectionSkeleton } from './PageSkeletons';

function useGovernance(user) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const available = Boolean(user?.id && user.role === 'admin' && !user.isDevelopmentPreview);
  useEffect(() => {
    setState((previous) => available && previous.userId === user.id && previous.data ? { ...previous, status: 'success', error: null } : { userId: user?.id, status: available ? 'loading' : 'idle', data: null, error: null });
    if (!available) return undefined;
    return startAuditPolling({
      load: (signal) => adminOverviewApi.governance({ signal }),
      onSuccess: (data) => setState({ userId: user.id, data, status: 'success', error: null }),
      onError: (error) => setState((previous) => ({ ...previous, data: [401,403].includes(error?.status) ? null : previous.data, status: 'error', error })),
    });
  }, [user?.id, available, revision]);
  return { ...(available && state.userId === user.id ? state : { data: null, status: available ? 'loading' : 'idle' }), available, retry: () => setRevision((value) => value + 1) };
}

function CountValue({ value }) {
  const [shown, setShown] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); previous.current = value; return; }
    let frame;
    const from = previous.current;
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min(1, (now - start) / 320);
      setShown(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(update);
      else previous.current = value;
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return Number(shown).toLocaleString('en-PH');
}

function LoadingRows({ label }) {
  return <SectionSkeleton variant="list" rows={3} label={label} />;
}
function Empty({ title, children, icon = 'users' }) {
  return <div className="gv-empty"><span><Icon name={icon} size={23} /></span><strong>{title}</strong><p>{children}</p></div>;
}
function Panel({ title, description, children, to, link }) {
  return <section className="gv-panel"><header><div><h2>{title}</h2><p>{description}</p></div>{to && <Link to={to}>{link} <Icon name="arrow" size={15} /></Link>}</header>{children}</section>;
}
export default function GovernanceOverview() {
  const { user } = useAuth();
  const result = useGovernance(user);
  const data = result.data;
  const unavailable = result.status === 'error' && !data;
  return <AdminShell title="Platform Governance" eyebrow="SafeLink administration"><div className="gv-page">
    <div className="gv-status"><span><i /> Administrator overview</span><span>{data ? `Updated ${auditTime(data.generatedAt)} · Philippine time` : result.status === 'error' ? 'Overview unavailable' : 'Loading verified account information'} · Refreshes every 15 seconds while visible</span></div>
    {result.status === 'error' && <div className="gv-error" role="alert"><div><strong>Overview could not be refreshed.</strong><p>{data ? 'Previously loaded records may be out of date.' : 'Counts and records are unavailable. Please try again.'}</p></div><button type="button" onClick={result.retry}>Retry overview</button></div>}
    <div className="gv-kpis">{[
      ['Total Users', 'totalUsers', 'All registered SafeLink accounts', 'users', 'blue'],
      ['Active Personnel', 'activePersonnel', 'Active Barangay, LGU and Police accounts', 'shield', 'teal'],
      ['Suspended Accounts', 'suspendedAccounts', 'Accounts with restricted access', 'priority', 'red'],
      ['Recent Security Events', 'securityEvents24h', 'Account and authentication events · last 24 hours', 'history', 'amber'],
    ].map(([title,key,description,icon,tone]) => <section className={`gv-kpi gv-${tone}`} key={key}><span className="gv-icon"><Icon name={icon} size={22} /></span><div><h3>{title}</h3><strong>{data ? <CountValue value={data.metrics[key]} /> : unavailable ? '—' : <span className="gv-number-skeleton" role="status" aria-label={`Loading ${title}`} />}</strong><p>{description}</p></div></section>)}</div>
    <div className="gv-main-grid">
      <Panel title="Recently Created Personnel" description="The five newest official accounts, including historical records." to="/admin/personnel" link="View All Personnel">
        {!data ? unavailable ? <Empty title="Personnel unavailable">Retry the overview to load official accounts.</Empty> : <LoadingRows label="Loading recently created personnel" /> : !data.recentPersonnel.length ? <Empty title="No personnel accounts yet">Create an authorized account to get started.</Empty> : <ul className="gv-personnel">{data.recentPersonnel.map((person) => <li key={person._id}><span className="gv-avatar">{person.firstName?.[0] || 'P'}{person.lastName?.[0] || ''}</span><div><strong>{[person.firstName, person.middleInitial, person.lastName].filter(Boolean).join(' ')}</strong><span>{auditRoles[person.role] || person.role}</span><small><Icon name="pin" size={12} />{[person.jurisdiction?.barangay,person.jurisdiction?.municipalityOrCity].filter(Boolean).join(', ') || 'Jurisdiction not assigned'}</small><time dateTime={person.createdAt}>Created {auditTime(person.createdAt)}</time></div><span className={`gv-badge gv-status-${person.status}`}>{person.status}</span></li>)}</ul>}
      </Panel>
      <Panel title="Recent Audit Events" description="The five latest recorded account and security activities." to="/admin/audit-logs" link="View All">
        <div className="gv-audit"><RecentAuditEvents result={{ ...result, data: data ? { data: data.recentEvents } : null }} /></div>
      </Panel>
    </div>
    {data && <p className="gv-footnote">Security window: {auditTime(data.window.from)} – {auditTime(data.window.to)} (Asia/Manila). Counts reflect stored account status and recorded events.</p>}
  </div></AdminShell>;
}
