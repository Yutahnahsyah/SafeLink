import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  dagupanView,
  globeConnections,
  globeLocations,
} from "../data/globeNetwork";
import GlobeFallback from "./globe/GlobeFallback";
import { GlobeSkeleton } from "./Skeleton";
import "./SafeLinkGlobe.css";

const GlobeScene = lazy(() => import("./globe/GlobeScene"));

class GlobeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <GlobeFallback /> : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Original SafeLink globe. rotationSpeed is radians/second; data is illustrative. */
export default function SafeLinkGlobe({
  locations = globeLocations,
  connections = globeConnections,
  initialView = dagupanView,
  rotationSpeed = 0.012,
  interactive = true,
  className = "",
}) {
  const container = useRef(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compact, setCompact] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 640px)");
    const update = () => {
      setReducedMotion(motion.matches);
      setCompact(mobile.matches);
    };
    const onVisibility = () => setPageVisible(!document.hidden);
    update();
    onVisibility();
    motion.addEventListener("change", update);
    mobile.addEventListener("change", update);
    document.addEventListener("visibilitychange", onVisibility);
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFailed(!supportsWebGL());
          setReady(true);
          preload.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    let frame = 0;
    const checkVisibility = () => {
      frame = 0;
      const rect = container.current?.getBoundingClientRect();
      setVisible(
        Boolean(
          rect &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth,
        ),
      );
    };
    const scheduleVisibility = () => {
      if (!frame) frame = requestAnimationFrame(checkVisibility);
    };
    preload.observe(container.current);
    checkVisibility();
    window.addEventListener("scroll", scheduleVisibility, { passive: true });
    window.addEventListener("resize", scheduleVisibility);
    return () => {
      preload.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleVisibility);
      window.removeEventListener("resize", scheduleVisibility);
      motion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const animate = visible && pageVisible && !paused && !reducedMotion;
  const selectedLocation = locations.find(
    (location) => location.id === selected,
  );

  return (
    <div ref={container} className={`network-globe ${className}`}>
      <div
        className="network-globe-stage"
        data-motion={animate ? "running" : "paused"}
      >
        {ready && !failed ? (
          <GlobeBoundary>
            <Suspense fallback={<GlobeSkeleton />}>
              <GlobeScene
                locations={locations}
                connections={connections}
                initialView={initialView}
                rotationSpeed={rotationSpeed}
                interactive={interactive}
                animate={animate}
                compact={compact}
                selected={selected}
                onSelect={setSelected}
                resetKey={resetKey}
                onFailure={() => setFailed(true)}
              />
            </Suspense>
          </GlobeBoundary>
        ) : failed ? (
          <GlobeFallback />
        ) : (
          <GlobeSkeleton />
        )}
      </div>
      <div className="network-globe-toolbar">
        <span>
          Philippines <span aria-hidden="true">/</span> Demo network
        </span>
        <div>
          <button
            type="button"
            onClick={() => {
              setResetKey((key) => key + 1);
              setSelected(null);
            }}
            disabled={!ready || failed}
          >
            Reset view
          </button>
          <button
            type="button"
            aria-pressed={paused || reducedMotion}
            disabled={reducedMotion || !ready || failed}
            onClick={() => setPaused((value) => !value)}
          >
            {paused || reducedMotion ? "Motion paused" : "Pause motion"}
          </button>
        </div>
      </div>
      <div
        className="network-location-list"
        aria-label="Illustrative network locations"
      >
        {locations.map((location) => (
          <button
            type="button"
            key={location.id}
            aria-pressed={selected === location.id}
            onClick={() =>
              setSelected(selected === location.id ? null : location.id)
            }
          >
            <i style={{ background: location.color }} />
            {location.name}
          </button>
        ))}
      </div>
      <p className="network-location-detail" aria-live="polite">
        {selectedLocation
          ? `${selectedLocation.name} — ${selectedLocation.description}. Illustrative location only.`
          : "Drag to explore · Select a location to learn its role"}
      </p>
    </div>
  );
}
