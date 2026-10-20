import { useCallback } from 'react';
import { publicMapApi } from '../services/safelinkApi';
import { useApiResource } from '../services/useApiResource';
import { publicIncidentColor } from '../services/publicIncidentMarkers';
import SafeLinkMap from './maps/SafeLinkMap';
import './PublicResolvedMap.css';

export default function PublicResolvedMap({ compact = false, heroMode = false }) {
  const load = useCallback(() => publicMapApi.resolved(), []);
  const result = useApiResource(load, [], { initialData: null });
  const failed = result.status === 'error' || result.refreshError;
  const ready = result.status === 'success' && !failed;
  const items = ready ? result.data?.items || [] : [];
  const categories = [...new Set(items.map(item => item.category))].sort();

  return <>
    <SafeLinkMap mode="public-resolved" items={items} compact={compact} heroMode={heroMode} publicResolved />
    {categories.length > 0 && <div className="public-incident-legend" aria-label="Incident category legend">
      {categories.map(category => <span key={category}><i style={{ background: publicIncidentColor(category) }} />{category}</span>)}
    </div>}
    {!ready && !failed && <div className="public-map-feedback" role="status">Loading public resolved reports…</div>}
    {ready && !items.length && <div className="public-map-feedback" role="status">No publicly approved resolved reports are available yet.</div>}
    {failed && <div className="public-map-feedback" role="alert">Public reports are unavailable. <button type="button" onClick={result.retry}>Retry</button></div>}
    {ready && result.data?.metadata?.truncated && <div className="public-map-feedback" role="status">Showing a limited set of publicly resolved reports.</div>}
  </>;
}
