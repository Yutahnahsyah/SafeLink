import { useCallback, useEffect, useMemo, useState } from "react";
import SafeLinkMap from "./maps/SafeLinkMap";
import { incidentApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";
import { getAccessToken } from "../services/apiClient";

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
  filterDate = "30",
}) {
  const [categoryFilter, setCategoryFilter] = useState(filterCategory);
  const [statusFilter, setStatusFilter] = useState(filterStatus);
  const [mapIntroDone, setMapIntroDone] = useState(false);
  const loadMap = useCallback(() => incidentApi.map().then((result) => result.items), []);
  const mapResult = useApiResource(loadMap, [], { enabled: Boolean(getAccessToken()), initialData: [] });
  useEffect(() => setCategoryFilter(filterCategory), [filterCategory]);
  useEffect(() => setStatusFilter(filterStatus), [filterStatus]);

  const visibleIncidents = useMemo(
    () =>
      (mapResult.data || []).filter((incident) => {
        const categoryMatches =
          categoryFilter === "all" ||
          incident.category === categoryFilter ||
          incident.category === categoryFilter;
        const statusMatches = statusFilter === "all" || incident.status === statusFilter;
        const cityMatches = filterCity === "all" || incident.municipality === filterCity;
        const barangayMatches = filterBarangay === "all" || incident.barangay === filterBarangay;
        const priorityMatches = filterPriority === "all" || incident.priority === filterPriority;
        const dateMatches = filterDate === "all" || !filterDate;
        return categoryMatches && statusMatches && cityMatches && barangayMatches && priorityMatches && dateMatches;
      }),
    [categoryFilter, statusFilter, filterCity, filterBarangay, filterPriority, filterDate, mapResult.data],
  );

  return (
    <>
      <SafeLinkMap
        mode="incidents"
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
              <option>Missing or vulnerable persons</option>
              <option>Harassment or unsafe encounters</option>
              <option>Dangerous road incidents</option>
              <option>People requiring assistance</option>
              <option>Public fire or smoke incidents</option>
              <option>People needing assistance during flooding</option>
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
              <option>Submitted</option>
              <option>Under Validation</option>
              <option>Verified</option>
              <option>Rejected</option>
              <option>In Progress</option>
              <option value="Resolved">Resolved</option>
              <option>Closed</option>
            </select>
          </label>
        </div>
      )}
    </>
  );
}
