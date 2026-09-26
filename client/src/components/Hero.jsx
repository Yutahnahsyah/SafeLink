import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import SafetyMap from "./SafetyMap";
import { Link } from "../routing";

function StatNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (reduced) {
          setDisplay(value);
        } else {
          let start;
          const tick = (time) => {
            start ??= time;
            const progress = Math.min((time - start) / 900, 1);
            setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <strong ref={ref}>
      {display}
      {suffix}
    </strong>
  );
}

const stats = [
  { value: 120, suffix: "+", label: "Reports Submitted" },
  { value: 24, label: "Active Incidents" },
  { value: 86, label: "Resolved Reports" },
  { value: 3, label: "Partner Agencies" },
];

export default function Hero() {
  const [selectedIncident, setSelectedIncident] = useState(null);

  return (
    <section id="home" className="hero hero--centered">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-location-lines" aria-hidden="true" />
      <div className="container hero-center">
        <div className="hero-intro reveal">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> Community safety, connected
          </div>
          <h1>
            Report. Verify. <span>Respond.</span>
          </h1>
          <p className="hero-lede">
            One connected platform where citizens can report safety concerns and
            authorized personnel can verify, coordinate, track, and respond.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/login/citizen?next=/citizen/report">
              Report an incident <Icon name="arrow" size={17} />
            </Link>
            <Link className="button button-secondary" to="/safety-map">
              <Icon name="map" size={18} /> Explore safety map
            </Link>
          </div>
        </div>

        <div
          className="hero-stats reveal delay-1"
          aria-label="SafeLink platform statistics"
        >
          {stats.map((stat) => (
            <div className="hero-stat" key={stat.label}>
              <StatNumber value={stat.value} suffix={stat.suffix} />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="hero-map-shell reveal delay-1">
          <div className="map-frame hero-map-frame">
            <div className="map-topbar">
              <span>
                <span className="live-dot" /> Live community safety map
              </span>
            </div>
            <SafetyMap heroMode onSelectIncident={setSelectedIncident} />
          </div>

          {selectedIncident && (
            <aside className="selected-incident" aria-live="polite">
              <button
                className="selected-close"
                onClick={() => setSelectedIncident(null)}
                aria-label="Close incident details"
              >
                ×
              </button>
              <span className="selected-label">Selected incident</span>
              <div className="selected-heading">
                <span
                  className="incident-icon"
                  style={{ "--incident-color": selectedIncident.color }}
                >
                  <Icon
                    name={
                      selectedIncident.category === "Road Hazard"
                        ? "priority"
                        : selectedIncident.category === "Flooding"
                          ? "layers"
                          : "report"
                    }
                    size={18}
                  />
                </span>
                <div>
                  <h2>{selectedIncident.category}</h2>
                  <p>{selectedIncident.location}</p>
                </div>
              </div>
              <div className="selected-meta">
                <span>Reported {selectedIncident.time}</span>
                <span
                  className={`status status-${selectedIncident.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {selectedIncident.status}
                </span>
              </div>
              <Link to="/login/citizen?next=/citizen/reports">
                View report <Icon name="arrow" size={15} />
              </Link>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
