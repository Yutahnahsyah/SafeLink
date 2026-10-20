import { useEffect, useRef, useState } from 'react';
import { publicStatisticsApi } from '../services/safelinkApi';
import { useApiResource } from '../services/useApiResource';
import { observeCountUp } from '../services/countUp';
import './HeroStatistics.css';

const statistics = [
  { key: 'totalReports', label: 'Reports Submitted' },
  { key: 'activeReports', label: 'Active Incidents' },
  { key: 'resolvedReports', label: 'Resolved Reports' },
  { key: 'partnerAgencies', label: 'Partner Agencies' },
];
const loadStatistics = () => publicStatisticsApi.overview();
const isCount = value => Number.isSafeInteger(value) && value >= 0;

export function StatNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const element = useRef(null);
  const completed = useRef(false);
  useEffect(() => {
    if (!isCount(value)) return undefined;
    if (completed.current) { setDisplay(value); return undefined; }
    return observeCountUp(element.current, value, next => {
      setDisplay(next);
      if (next === value) completed.current = true;
    });
  }, [value]);
  return <strong ref={element}>{isCount(value) ? display.toLocaleString('en-US') : '—'}</strong>;
}

export default function HeroStatistics() {
  const result = useApiResource(loadStatistics);
  const failed = result.status === 'error' || Boolean(result.refreshError);
  const ready = result.status === 'success' && !failed;
  return (
    <div className="hero-statistics-block">
      <div className="hero-stats reveal delay-1" aria-label="SafeLink platform statistics" aria-busy={result.status === 'loading'}>
        {statistics.map(({ key, label }) => (
          <div className="hero-stat" key={key} title={ready ? result.data?.definitions?.[key] : undefined}>
            <StatNumber value={ready ? result.data?.summary?.[key] : null} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      {result.status === 'loading' && <p className="hero-statistics-feedback" role="status">Loading platform statistics…</p>}
      {failed && <p className="hero-statistics-feedback" role="alert">Statistics are temporarily unavailable. <button type="button" onClick={result.retry}>Retry</button></p>}
      {ready && result.data?.notice && <p className="hero-statistics-feedback">{result.data.notice}</p>}
    </div>
  );
}
