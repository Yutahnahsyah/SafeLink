import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapSkeleton } from "../Skeleton";
import "./SafeLinkMap.css";

const PANGASINAN_CENTER = [16.04, 120.32];
const PANGASINAN_BOUNDS = [[15.74, 119.82], [16.27, 120.83]];
const PANGASINAN_PAN_BOUNDS = [[15.25, 119.05], [16.85, 121.55]];
const PANGASINAN_INTRO_MAX_BOUNDS = [[14.7, 117.5], [17.6, 123.5]];
const PANGASINAN_INTRO_CENTER = [16.29, 120.72];
const PANGASINAN_APPROACH_CENTER = [16.11, 120.46];
const cartoApiKey = import.meta.env["VITE_CARTO_API_KEY"];

function createJurisdictionMask(boundary) {
  const geometry = boundary?.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return null;
  const exteriorRings = geometry.type === "Polygon"
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map((polygon) => polygon[0]);
  return {
    type: "Feature",
    properties: { role: "outside-jurisdiction-mask" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [[117.5, 14.7], [123.5, 14.7], [123.5, 17.6], [117.5, 17.6], [117.5, 14.7]],
        ...exteriorRings,
      ],
    },
  };
}

// Simplified from the DENR Provincial Boundary feature layer (province code 105500000).
const PANGASINAN_BOUNDARY = {
  type: "Feature",
  properties: { name: "Pangasinan" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [119.7501, 15.9663], [119.7715, 15.9159], [119.7842, 15.9316], [119.8048, 15.9222],
      [119.8215, 15.9606], [119.8648, 15.9557], [119.914, 15.8395], [119.883, 15.8132],
      [119.982, 15.8076], [120.0146, 15.8414], [120.0179, 15.8706], [120.0364, 15.8741],
      [120.0765, 15.8326], [120.1456, 15.8255], [120.1596, 15.7693], [120.2529, 15.6178],
      [120.2705, 15.6425], [120.315, 15.6478], [120.3786, 15.7483], [120.4277, 15.7538],
      [120.4676, 15.7222], [120.551, 15.7637], [120.5901, 15.8624], [120.6036, 15.8609],
      [120.6151, 15.8156], [120.7474, 15.8513], [120.8191, 15.7932], [120.8685, 15.8557],
      [120.8675, 15.8847], [120.9015, 15.9126], [120.9205, 15.9663], [120.8415, 16.1686],
      [120.7689, 16.1981], [120.6292, 16.1804], [120.5202, 16.2334], [120.5067, 16.2067],
      [120.4173, 16.2046], [120.4199, 16.1566], [120.3304, 16.0625], [120.2305, 16.0372],
      [120.1915, 16.049], [120.1421, 16.0381], [120.0971, 16.0652], [120.0989, 16.0812],
      [120.1142, 16.0789], [120.0935, 16.0951], [120.0885, 16.1164], [120.1053, 16.1249],
      [120.0864, 16.1464], [120.1056, 16.1351], [120.1109, 16.1455], [120.088, 16.168],
      [120.0726, 16.163], [120.0726, 16.1787], [120.0475, 16.1776], [120.0453, 16.1925],
      [120.0351, 16.184], [120.0434, 16.1946], [120.0115, 16.1705], [120.0025, 16.1948],
      [119.971, 16.2111], [119.9771, 16.2284], [119.9571, 16.2204], [119.954, 16.2368],
      [119.9184, 16.2478], [119.9137, 16.3041], [119.9304, 16.3649], [119.9188, 16.3675],
      [119.9251, 16.3835], [119.91, 16.3784], [119.8972, 16.3941], [119.8557, 16.3568],
      [119.8167, 16.36], [119.7817, 16.316], [119.772, 16.2763], [119.7836, 16.2389],
      [119.7533, 16.1703], [119.7707, 16.1645], [119.7813, 16.133], [119.7636, 16.1128],
      [119.7558, 16.0502], [119.7746, 16.0236], [119.7501, 15.9663],
    ]],
  },
};

if (import.meta.env.DEV) {
  console.info("CARTO key:", cartoApiKey ? "Loaded" : "Missing");
  if (!cartoApiKey) console.warn("VITE_CARTO_API_KEY is missing");
}

const networkColors = {
  community: "#27b9b2",
  barangay: "#45af7d",
  lgu: "#218bc7",
  police: "#35a9c6",
  disaster: "#d69b35",
};

function MapLifecycle({ onMapClick }) {
  const map = useMapEvents({
    click(event) {
      onMapClick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(container);
    const firstFrame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    const settledLayout = window.setTimeout(() => map.invalidateSize({ animate: false }), 250);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(firstFrame);
      window.clearTimeout(settledLayout);
    };
  }, [map]);

  return null;
}

function PangasinanMapController({ ready, onBoundaryReveal, onComplete, onPhaseChange }) {
  const map = useMap();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!ready || hasAnimated.current) return;
    hasAnimated.current = true;

    map.invalidateSize({ animate: false });
    const changePhase = (phase) => {
      const center = map.getCenter();
      const container = map.getContainer();
      container.dataset.cameraCenter = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
      container.dataset.cameraZoom = map.getZoom().toFixed(2);
      onPhaseChange(phase);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.fitBounds(PANGASINAN_BOUNDS, { padding: [28, 28], maxZoom: 11 });
      map.setMaxBounds(PANGASINAN_PAN_BOUNDS);
      onBoundaryReveal();
      changePhase("complete");
      onComplete();
      return;
    }

    let completed = false;
    let didSettle = false;
    let panFallbackTimer;
    let settleFallbackTimer;
    let revealTimer;
    let startTimer;
    const complete = () => {
      if (completed) return;
      completed = true;
      changePhase("complete");
      onComplete();
    };
    const settle = () => {
      if (didSettle) return;
      didSettle = true;
      window.clearTimeout(settleFallbackTimer);
      map.setMaxBounds(PANGASINAN_PAN_BOUNDS);
      changePhase("boundary");
      onBoundaryReveal();
      revealTimer = window.setTimeout(complete, 140);
    };
    const flyHome = () => {
      window.clearTimeout(panFallbackTimer);
      map.off("moveend", flyHome);
      changePhase("settling");
      map.once("moveend", settle);
      settleFallbackTimer = window.setTimeout(settle, 1250);
      map.flyToBounds(PANGASINAN_BOUNDS, {
        padding: [24, 24],
        maxZoom: 11,
        duration: 0.95,
        easeLinearity: 0.24,
      });
    };

    map.setView(PANGASINAN_INTRO_CENTER, 9.1, { animate: false });
    changePhase("offset");
    startTimer = window.setTimeout(() => {
      changePhase("panning");
      map.once("moveend", flyHome);
      panFallbackTimer = window.setTimeout(flyHome, 760);
      map.panTo(PANGASINAN_APPROACH_CENTER, {
        animate: true,
        duration: 0.58,
        easeLinearity: 0.3,
      });
    }, 120);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(panFallbackTimer);
      window.clearTimeout(settleFallbackTimer);
      window.clearTimeout(revealTimer);
      map.off("moveend", flyHome);
      map.off("moveend", settle);
      if (!completed) hasAnimated.current = false;
    };
  }, [map, onBoundaryReveal, onComplete, onPhaseChange, ready]);

  return null;
}

function LocalityMapController({ ready, view, compact, onBoundaryReveal, onComplete, onPhaseChange }) {
  const map = useMap();
  const hasAnimated = useRef(false);
  const boundaryBounds = useMemo(() => {
    if (!view?.boundary) return null;
    const bounds = L.geoJSON(view.boundary).getBounds();
    return bounds.isValid() ? bounds : null;
  }, [view?.boundary]);

  useEffect(() => {
    if (!ready || hasAnimated.current || (!boundaryBounds && !view?.center)) return undefined;
    hasAnimated.current = true;
    let completed = false;
    let startTimer;
    let fallbackTimer;
    const targetPadding = map.getSize().x < 520 ? [14, 14] : compact ? [18, 18] : [36, 36];

    const updatePhase = (phase) => {
      const center = map.getCenter();
      const container = map.getContainer();
      container.dataset.cameraCenter = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
      container.dataset.cameraZoom = map.getZoom().toFixed(2);
      onPhaseChange(phase);
    };
    const complete = () => {
      if (completed) return;
      completed = true;
      map.off("moveend", complete);
      if (boundaryBounds) {
        map.setMaxBounds(boundaryBounds.pad(compact ? 0.9 : 0.75));
        onBoundaryReveal();
      }
      updatePhase("complete");
      onComplete();
    };

    map.invalidateSize({ animate: false });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (boundaryBounds) {
        map.fitBounds(boundaryBounds, { padding: targetPadding, maxZoom: 13.4, animate: false });
      } else {
        map.setView(view.center, view.zoom, { animate: false });
      }
      complete();
      return undefined;
    }

    if (boundaryBounds) {
      map.fitBounds(boundaryBounds.pad(compact ? 1.15 : 1.4), {
        padding: [0, 0],
        maxZoom: compact ? 11.1 : 10.8,
        animate: false,
      });
    } else {
      map.setView(PANGASINAN_CENTER, 9, { animate: false });
    }
    updatePhase("locality-approach");
    startTimer = window.setTimeout(() => {
      updatePhase("locality-focus");
      map.once("moveend", complete);
      fallbackTimer = window.setTimeout(complete, 2100);
      if (boundaryBounds) {
        map.flyToBounds(boundaryBounds, {
          padding: targetPadding,
          maxZoom: 13.4,
          duration: 1.55,
          easeLinearity: 0.24,
        });
      } else {
        map.flyTo(view.center, view.zoom, { duration: 1.55, easeLinearity: 0.24 });
      }
    }, 120);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(fallbackTimer);
      map.off("moveend", complete);
      if (!completed) hasAnimated.current = false;
    };
  }, [boundaryBounds, compact, map, onBoundaryReveal, onComplete, onPhaseChange, ready, view]);

  return null;
}

function IncidentMarker({ incident, index, heroMode, onSelectIncident }) {
  const icon = useMemo(
    () => L.divIcon({
      className: "safelink-marker-icon incident-map-marker",
      html: `<span class="map-marker${incident.status === "Resolved" ? " is-resolved" : ""}" style="--marker:${incident.color};--marker-delay:${Math.min(index, 8) * 75}ms"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -13],
    }),
    [incident.color, incident.status, index],
  );

  return (
    <Marker
      position={[incident.coords[1], incident.coords[0]]}
      icon={icon}
      keyboard
      title={`${incident.category} — ${incident.location}`}
      alt={`${incident.category} in ${incident.location}`}
      eventHandlers={heroMode && onSelectIncident ? { click: () => onSelectIncident(incident) } : undefined}
    >
      {!heroMode && (
        <Popup className="incident-popup" offset={[0, -2]}>
          <div className="incident-popup-content">
            <strong>{incident.category}</strong>
            <span>{incident.location}</span>
            <small>{incident.status} · {incident.time}</small>
          </div>
        </Popup>
      )}
    </Marker>
  );
}

function NetworkMarker({ location }) {
  const color = networkColors[location.category] || networkColors.community;
  const icon = useMemo(
    () => L.divIcon({
      className: `safelink-marker-icon network-map-marker network-map-marker--${location.category}`,
      html: `<span class="map-marker network-marker-dot" style="--marker:${color}"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14],
    }),
    [color, location.category],
  );

  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={icon}
      keyboard
      title={`${location.name} — ${location.type}`}
      alt={`${location.name}, ${location.type}`}
    >
      <Popup className="network-popup" maxWidth={260} minWidth={200}>
        <div className="network-popup-content">
          <strong>{location.name}</strong>
          <span>{location.type}</span>
          <p>{location.role}</p>
          <small>Illustrative network location</small>
        </div>
      </Popup>
    </Marker>
  );
}

export default function SafeLinkMap({
  mode = "incidents",
  items = [],
  compact = false,
  interactive = true,
  heroMode = false,
  mapRef,
  onMapClick,
  onReady,
  onSelectIncident,
  focusView,
  className = "",
}) {
  const isNetwork = mode === "network";
  const [usingFallback, setUsingFallback] = useState(!cartoApiKey);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [initialAnimationDone, setInitialAnimationDone] = useState(false);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const [introPhase, setIntroPhase] = useState("waiting");
  const [inViewport, setInViewport] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const readyNotified = useRef(false);
  const tileFailureNotified = useRef(false);
  const rootRef = useRef(null);
  const jurisdictionMask = useMemo(
    () => createJurisdictionMask(focusView?.boundary),
    [focusView?.boundary],
  );

  const markTilesLoaded = useCallback(() => {
    setTilesLoaded(true);
  }, []);

  const finishInitialAnimation = useCallback(() => {
    setInitialAnimationDone(true);
    if (!readyNotified.current) {
      readyNotified.current = true;
      onReady?.();
    }
  }, [onReady]);

  const revealBoundary = useCallback(() => setBoundaryVisible(true), []);
  const updateIntroPhase = useCallback((phase) => setIntroPhase(phase), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (!("IntersectionObserver" in window)) {
      setInViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInViewport(true);
        observer.disconnect();
      },
      { threshold: 0.18 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const handleTileError = useCallback(
    (error) => {
      if (import.meta.env.DEV && !tileFailureNotified.current) {
        tileFailureNotified.current = true;
        console.warn("Map tiles are unavailable; SafeLink is switching map sources.", {
          type: error?.type || "tileerror",
          source: usingFallback ? "OpenStreetMap" : "CARTO",
        });
      }
      if (!usingFallback) {
        setUsingFallback(true);
        return;
      }
      setFallbackFailed(true);
      markTilesLoaded();
    },
    [markTilesLoaded, usingFallback],
  );

  useEffect(() => {
    if (usingFallback || tilesLoaded) return undefined;
    const fallbackTimer = window.setTimeout(() => {
      if (import.meta.env.DEV && !tileFailureNotified.current) {
        tileFailureNotified.current = true;
        console.warn("CARTO map tiles timed out; SafeLink is switching map sources.");
      }
      setUsingFallback(true);
    }, 15000);
    return () => window.clearTimeout(fallbackTimer);
  }, [markTilesLoaded, tilesLoaded, usingFallback]);

  return (
    <div
      ref={rootRef}
      className={`safelink-map-root ${tilesLoaded ? "is-ready" : ""} ${tilesLoaded && inViewport && !initialAnimationDone ? "is-animating" : ""} ${initialAnimationDone ? "is-settled" : ""} ${focusView?.boundary ? "has-jurisdiction-boundary" : ""}`}
      data-intro-phase={introPhase}
      data-jurisdiction={focusView?.label || undefined}
      aria-busy={!initialAnimationDone}
    >
      <MapContainer
        ref={mapRef}
        className={`map-canvas map-surface safelink-leaflet-map safelink-leaflet-map--${mode} ${className}`}
        center={focusView?.center || PANGASINAN_CENTER}
        zoom={focusView?.zoom || 8}
        maxBounds={PANGASINAN_INTRO_MAX_BOUNDS}
        maxBoundsViscosity={0.72}
        minZoom={8}
        maxZoom={15}
        zoomSnap={0.2}
        zoomControl={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        scrollWheelZoom={false}
        attributionControl
        aria-label={focusView ? `Authorized incident map for ${focusView.label || "assigned LGU jurisdiction"}` : isNetwork ? "Illustrative SafeLink response network in Pangasinan" : "Map of sample community incidents in Pangasinan"}
      >
        <TileLayer
          key={usingFallback ? "osm" : "carto"}
          attribution={
            usingFallback
              ? `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>${focusView?.boundary ? ' | Boundary: <a href="https://www.geoboundaries.org/">geoBoundaries</a>' : ""}`
              : `&copy; OpenStreetMap contributors &copy; CARTO${focusView?.boundary ? ' | Boundary: <a href="https://www.geoboundaries.org/">geoBoundaries</a>' : ""}`
          }
          url={
            usingFallback
              ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoApiKey}`
          }
          subdomains={usingFallback ? "abc" : "abcd"}
          maxZoom={19}
          eventHandlers={{
            load: markTilesLoaded,
            tileload: markTilesLoaded,
            tileerror: handleTileError,
          }}
        />
        {interactive && <ZoomControl position={isNetwork ? "topleft" : "topright"} />}
        <MapLifecycle onMapClick={interactive ? onMapClick : undefined} />
        {focusView ? <LocalityMapController
          ready={tilesLoaded && inViewport}
          view={focusView}
          compact={compact}
          onBoundaryReveal={revealBoundary}
          onComplete={finishInitialAnimation}
          onPhaseChange={updateIntroPhase}
        /> : <PangasinanMapController
          ready={tilesLoaded && inViewport}
          onBoundaryReveal={revealBoundary}
          onComplete={finishInitialAnimation}
          onPhaseChange={updateIntroPhase}
        />}
        {!focusView && <GeoJSON
          data={PANGASINAN_BOUNDARY}
          interactive={false}
          style={{
            className: "pangasinan-boundary",
            color: "#0aa9ad",
            fillColor: "#22b8b2",
            fillOpacity: boundaryVisible ? 0.055 : 0,
            opacity: boundaryVisible ? 0.76 : 0,
            weight: 2.2,
          }}
        />}
        {jurisdictionMask && <GeoJSON
          data={jurisdictionMask}
          interactive={false}
          style={{
            className: "jurisdiction-outside-mask",
            color: "transparent",
            fillColor: "#173b45",
            fillOpacity: boundaryVisible ? 0.075 : 0,
            fillRule: "evenodd",
            opacity: 0,
            weight: 0,
          }}
        />}
        {focusView?.boundary && <GeoJSON
          data={focusView.boundary}
          interactive={false}
          style={{
            className: "jurisdiction-boundary",
            color: "#087f86",
            fillColor: "#20b9b2",
            fillOpacity: boundaryVisible ? 0.105 : 0,
            opacity: boundaryVisible ? 0.92 : 0,
            weight: compact ? 2.15 : 2.6,
          }}
        />}
        {initialAnimationDone && (isNetwork
          ? items.map((location) => <NetworkMarker key={location.id} location={location} />)
          : items.map((incident, index) => (
              <IncidentMarker
                key={incident.id}
                incident={incident}
                index={index}
                heroMode={heroMode}
                onSelectIncident={onSelectIncident}
              />
            )))}
      </MapContainer>
      <MapSkeleton compact={compact || isNetwork} />
      {usingFallback && tilesLoaded && (
        <p className={`map-tile-notice${fallbackFailed ? " is-error" : ""}`} role="status">
          {fallbackFailed
            ? "Map tiles unavailable. Network locations remain visible."
            : "Map style unavailable. Showing standard map."}
        </p>
      )}
    </div>
  );
}

export { PANGASINAN_BOUNDS };
