import { useCallback, useEffect, useMemo, useState } from "react";
import SafeLinkMap from "./maps/SafeLinkMap";
import { incidentApi, publicMapApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";
import { getAccessToken } from "../services/apiClient";

import { SectionSkeleton, ResourceError, RefreshNotice } from './PageSkeletons';

export default function SafetyMap({
  compact = false,
  interactive = true,
  heroMode = false,
  showFilters = heroMode,
  onSelectIncident,
  onMapClick,
  filterCategory = "all",
  filterStatus = "all",
  filterCity = "all",
  filterBarangay = "all",
  filterPriority = "all",
  publicOnly = false,
}) {
  const [categoryFilter, setCategoryFilter] = useState(filterCategory);
  const [statusFilter, setStatusFilter] = useState(filterStatus);
  const [mapIntroDone, setMapIntroDone] = useState(false);
  const loadMap = useCallback(() => (publicOnly ? publicMapApi.resolved() : incidentApi.map()).then((result) => result.items), [publicOnly]);
  const mapResult = useApiResource(loadMap, [publicOnly], { enabled: publicOnly || Boolean(getAccessToken()), initialData: [] });
  useEffect(() => setCategoryFilter(filterCategory), [filterCategory]);
  useEffect(() => setStatusFilter(filterStatus), [filterStatus]);

  const visibleIncidents = useMemo(
    () =>
      (mapResult.data || []).filter((incident) => {
        const categoryMatches = categoryFilter === "all" || incident.category === categoryFilter;
        const statusMatches = statusFilter === "all" || incident.status === statusFilter;
        const cityMatches = filterCity === "all" || incident.municipality === filterCity;
        const barangayMatches = filterBarangay === "all" || incident.barangay === filterBarangay;
        const priorityMatches = filterPriority === "all" || incident.priority === filterPriority;
        return categoryMatches && statusMatches && cityMatches && barangayMatches && priorityMatches;
      }),
    [categoryFilter, statusFilter, filterCity, filterBarangay, filterPriority, mapResult.data],
  );

  if (mapResult.status === 'loading') return <SectionSkeleton variant="map" label="Loading community safety map" />;
  if (mapResult.status === 'error') return <ResourceError result={mapResult} label="Could not load the safety map." />;
  return (
    <>
      <RefreshNotice result={mapResult} />
      <SafeLinkMap
        mode={publicOnly ? "public-resolved" : "community"}
        publicResolved={publicOnly}
        items={visibleIncidents}
        compact={compact}
        interactive={interactive}
        heroMode={heroMode}
        onSelectIncident={onSelectIncident}
        onMapClick={onMapClick}
        onReady={() => setMapIntroDone(true)}
      />
      {showFilters && (
        <div className={`map-filters map-filters--intro${mapIntroDone ? " is-visible" : ""}`} aria-label="Map filters">
          <label>
            <span>Incident</span>
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                onSelectIncident?.(null);
              }}
              aria-label="Filter incidents by category"
            >
              <option value="all">All Incidents</option>
              <option>Suspicious activities</option>
              <option>Dangerous road incidents</option>
              <option>Public fire or smoke incidents</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                onSelectIncident?.(null);
              }}
              aria-label="Filter incidents by status"
            >
              <option value="all">All Statuses</option>
              {!publicOnly && <option>Verified</option>}
              {!publicOnly && <option>In Progress</option>}
              <option value="Resolved">Resolved</option>
              {!publicOnly && <option>Closed</option>}
            </select>
          </label>
        </div>
      )}
    </>
  );
}
