import { useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMapEvents } from 'react-leaflet';
import { groupCommunityIncidents, formatCommunityDate } from '../../services/communityIncidentMarkers.js';

const PAGE_SIZE = 10;
function CommunityMarker({ group, compactPopup }) {
  const [page, setPage] = useState(0);
  const grouped = group.members.length > 1;
  const lastPage = Math.ceil(group.members.length / PAGE_SIZE) - 1;
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * PAGE_SIZE;
  const icon = useMemo(() => L.divIcon({
    className: `community-map-marker${grouped ? ' is-cluster' : ''}`,
    html: `<span aria-hidden="true" style="--marker:${group.color}"></span>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -10],
  }), [group.color, grouped]);
  const title = grouped ? `${group.members.length} resolved reports across ${group.sameArea ? 'one generalized area' : 'nearby generalized areas'}. Open to browse all reports.`
    : `${group.members[0].category} in ${group.members[0].municipality}. Resolved.`;
  return <Marker position={group.position} icon={icon} keyboard title={title} alt={title}
    eventHandlers={{ popupclose: () => setPage(0) }}>
    <Popup key={compactPopup ? 'compact' : 'wide'} className="incident-popup community-popup" maxWidth={compactPopup ? 240 : 300} minWidth={210} maxHeight={compactPopup ? 160 : 300}
      autoPanPaddingTopLeft={[8, 12]} autoPanPaddingBottomRight={[52, 12]}>
      <div className="incident-popup-content" tabIndex={0} aria-label="Resolved incident information">
        {grouped && <strong>{group.sameArea ? 'Reports in this generalized area' : 'Reports in nearby generalized areas'}</strong>}
        {group.members.slice(start, start + PAGE_SIZE).map((entry) => <div className="community-popup-entry" key={entry.id}>
          <strong>{entry.category}</strong>
          <span>Location: {entry.municipality}, Pangasinan</span>
          {entry.barangay && <span>Barangay: {entry.barangay}</span>}
          <small>Generalized location: {entry.areaLevel}</small>
          <span className="community-resolved-badge">Resolved</span>
          <small>Reported: <time dateTime={entry.reportedDate}>{formatCommunityDate(entry.reportedDate)}</time></small>
          <small>Resolved: <time dateTime={entry.resolvedDate}>{formatCommunityDate(entry.resolvedDate)}</time></small>
        </div>)}
        {lastPage > 0 && <nav className="community-popup-pages" aria-label="Overlapping resolved reports">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous reports</button>
          <small role="status" aria-live="polite">Showing {start + 1}–{Math.min(start + PAGE_SIZE, group.members.length)} of {group.members.length}</small>
          <button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next reports</button>
        </nav>}
        <small>Location information is generalized to protect the reporter's privacy.</small>
      </div>
    </Popup>
  </Marker>;
}

export default function CommunityMarkers({ items }) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()), resize: (event) => setWidth(event.newSize.x) });
  const [zoom, setZoom] = useState(map.getZoom());
  const [width, setWidth] = useState(map.getSize().x);
  const groups = useMemo(() => groupCommunityIncidents(items, map, zoom), [items, map, zoom]);
  return groups.map((group) => <CommunityMarker key={`${zoom}-${group.id}`} group={group} compactPopup={width < 520} />);
}
