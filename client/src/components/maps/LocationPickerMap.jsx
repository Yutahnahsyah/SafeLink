import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./LocationPickerMap.css";

const PANGASINAN_CENTER = [16.04, 120.32];
const PANGASINAN_APPROACH_CENTER = [16.12, 120.46];
const PANGASINAN_FOCUS_BOUNDS = [[15.75, 119.75], [16.45, 120.95]];
const PICKER_BOUNDS = [[14.7, 117.5], [17.6, 123.5]];
const cartoApiKey = import.meta.env["VITE_CARTO_API_KEY"];

function PickerController({ focusRequest, hasSelectedLocation, introPlayedRef, onMapClick }) {
  const map = useMapEvents({
    click(event) {
      onMapClick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  const handledFocus = useRef(focusRequest?.id ?? null);

  useEffect(() => {
    if (hasSelectedLocation || focusRequest || introPlayedRef?.current) return undefined;
    const entranceTimer = window.setTimeout(() => {
      if (introPlayedRef) introPlayedRef.current = true;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const padding = map.getSize().x < 520 ? [16, 16] : [28, 24];
      map.flyToBounds(PANGASINAN_FOCUS_BOUNDS, {
        animate: !reducedMotion,
        duration: reducedMotion ? 0 : 1.6,
        easeLinearity: 0.25,
        maxZoom: 9.5,
        padding,
      });
    }, 220);
    return () => window.clearTimeout(entranceTimer);
  }, [focusRequest, hasSelectedLocation, introPlayedRef, map]);

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

  useEffect(() => {
    if (!focusRequest || handledFocus.current === focusRequest.id) return;
    handledFocus.current = focusRequest.id;
    map.flyTo([focusRequest.latitude, focusRequest.longitude], 17, {
      animate: true,
      duration: 1.5,
    });
  }, [focusRequest, map]);

  return null;
}

export default function LocationPickerMap({ selectedLocation, selectionRevision, focusRequest, introPlayedRef, onMapClick }) {
  const [usingFallback, setUsingFallback] = useState(!cartoApiKey);
  const position = selectedLocation
    ? [Number(selectedLocation.latitude), Number(selectedLocation.longitude)]
    : null;
  const restoreFocusedOverview = !position && introPlayedRef?.current;
  const markerIcon = useMemo(
    () => L.divIcon({
      className: "location-picker-marker-icon",
      html: '<span class="location-picker-marker"><i></i></span>',
      iconSize: [34, 42],
      iconAnchor: [17, 40],
    }),
    [],
  );

  return (
    <MapContainer
      className="location-picker-map"
      center={position || (restoreFocusedOverview ? PANGASINAN_CENTER : PANGASINAN_APPROACH_CENTER)}
      zoom={position ? 16 : restoreFocusedOverview ? 9 : 7.25}
      minZoom={7}
      maxZoom={19}
      zoomSnap={0.25}
      maxBounds={PICKER_BOUNDS}
      maxBoundsViscosity={0.65}
      zoomControl={false}
      scrollWheelZoom
      aria-label="Select where the incident happened"
    >
      <TileLayer
        key={usingFallback ? "osm" : "carto"}
        attribution={usingFallback
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          : '&copy; OpenStreetMap contributors &copy; CARTO'}
        url={usingFallback
          ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoApiKey}`}
        subdomains={usingFallback ? "abc" : "abcd"}
        maxZoom={19}
        eventHandlers={{ tileerror: () => setUsingFallback(true) }}
      />
      <ZoomControl position="topright" />
      <PickerController focusRequest={focusRequest} hasSelectedLocation={Boolean(position)} introPlayedRef={introPlayedRef} onMapClick={onMapClick} />
      {position && (
        <Marker
          key={`${position[0]}-${position[1]}-${selectionRevision}`}
          position={position}
          icon={markerIcon}
          keyboard
          title="Selected incident location"
          alt="Selected incident location"
        />
      )}
    </MapContainer>
  );
}

export { PANGASINAN_FOCUS_BOUNDS };
