import Icon from './Icon';
import { SectionSkeleton } from './PageSkeletons';

const statusTypes = [
  ['active', 'Active', '#078f9b'],
  ['pending', 'Pending Verification', '#e8a142'],
  ['suspended', 'Suspended', '#dc6475'],
];
const percent = (value, total) => Math.round(value / total * 100);

export default function AccountOverview({ result }) {
  const summary = result.data?.summary;
  const ready = Number.isFinite(summary?.total) && Number.isFinite(summary?.verified) && summary.statuses;
  let content;
  if (!ready) {
    content = result.status === 'loading'
      ? <SectionSkeleton variant="list" rows={2} label="Loading account overview" />
      : <div className="av-overview-state" role={result.status === 'error' ? 'alert' : 'status'}><p>Account overview is unavailable.</p><button type="button" onClick={result.retry}>Retry</button></div>;
  } else if (!summary.total) {
    content = <div className="av-overview-state" role="status"><strong>No accounts yet</strong><p>Verification and access shares will appear when accounts are registered.</p></div>;
  } else {
    const verified = percent(summary.verified, summary.total);
    const entries = statusTypes.map(([key, label, color]) => ({ key, label, color, value: summary.statuses[key] || 0 }));
    const other = Object.entries(summary.statuses).filter(([key]) => !statusTypes.some(([status]) => key === status)).reduce((sum, [, value]) => sum + value, 0);
    if (other) entries.push({ key: 'other', label: 'Other recorded status', color: '#8698aa', value: other });
    content = <div className="av-overview-body">
      <div className="av-verification-share">
        <div><span>Email verification</span><strong>{verified}%</strong></div>
        <div className="av-overview-meter" role="progressbar" aria-label="Verified account share" aria-valuemin={0} aria-valuemax={100} aria-valuenow={verified}><i style={{ width: `${verified}%` }} /></div>
        <p>Share of accounts with a verified email address.</p>
      </div>
      <div className="av-access-share">
        <h4>Account status</h4>
        <div className="av-status-track" role="img" aria-label={entries.map(item => `${item.label}: ${percent(item.value, summary.total)}%`).join(', ')}>{entries.map(item => <i key={item.key} style={{ width: `${item.value / summary.total * 100}%`, background: item.color }} />)}</div>
        <ul>{entries.map(item => <li key={item.key}><span><i style={{ background: item.color }} />{item.label}</span><strong>{percent(item.value, summary.total)}%</strong></li>)}</ul>
      </div>
    </div>;
  }
  return <section className="av-panel av-account-overview"><header><span className="av-icon"><Icon name="shield" size={22} /></span><div><h3>Account Overview</h3><p>Verification and access across all accounts.</p></div></header>{content}</section>;
}
