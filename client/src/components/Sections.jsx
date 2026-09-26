import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import SafetyMap from "./SafetyMap";
import { features, roles } from "../data";

function SectionTitle({ label, title, text, centered = false }) {
  return (
    <div className={`section-title ${centered ? "centered" : ""}`}>
      <span className="section-label">{label}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="section about-section">
      <div className="container">
        <div className="about-grid observe">
          <div>
            <span className="section-label">Built for coordinated action</span>
            <h2>
              One platform.
              <br />
              <span>Better coordination.</span>
            </h2>
          </div>
          <div className="about-copy">
            <p>
              SafeLink brings community reporting and official response into one
              clear, accountable workflow—helping the right information reach
              the right people at the right time.
            </p>
            <div className="coordination-flow">
              <span>Citizens</span>
              <i />
              <span>Verified information</span>
              <i />
              <span>Responders</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    [
      "report",
      "Report",
      "Citizens submit safety concerns with incident details, location, and supporting evidence.",
    ],
    [
      "shield",
      "Verify",
      "Authorized personnel review, validate, classify, and prioritize reports.",
    ],
    [
      "track",
      "Respond",
      "The appropriate barangay, LGU office, or partner agency handles and updates the incident.",
    ],
  ];
  return (
    <section id="how-it-works" className="section light">
      <div className="container">
        <SectionTitle
          label="A trusted process"
          title="From concern to coordinated response"
          text="A simple, transparent workflow built for communities and the people who serve them."
          centered
        />
        <div className="steps observe">
          {steps.map(([icon, title, text], i) => (
            <article className="step" key={title}>
              <div className="step-top">
                <span className="step-number">0{i + 1}</span>
                <span className="step-icon">
                  <Icon name={icon} size={24} />
                </span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              {i < 2 && (
                <span className="step-arrow">
                  <Icon name="arrow" size={18} />
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <div className="features-heading">
          <SectionTitle
            label="Core capabilities"
            title="Everything communities need to act with confidence"
          />
          <p>
            Purpose-built tools support reliable reports, responsible
            verification, and clearer response coordination.
          </p>
        </div>
        <div className="feature-grid observe">
          {features.map(([icon, title, text]) => (
            <article className="feature" key={title}>
              <span>
                <Icon name={icon} size={21} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const timeline = [
  ["Pending Validation", "Report received", "complete"],
  ["For Verification", "Being reviewed", "complete"],
  ["Verified", "Information confirmed", "complete"],
  ["Assigned", "Sent to responsible office", "complete"],
  ["Responding", "Action in progress", "current"],
  ["Resolved", "Incident completed", "future"],
];
export function IncidentTimeline() {
  return (
    <section className="section timeline-section">
      <div className="container timeline-layout">
        <div className="timeline-copy observe">
          <SectionTitle
            label="Transparent tracking"
            title="Know what happens next"
            text="Every submitted report follows a clear process, so citizens always know its current status and what happens next."
            centered
          />
        </div>
        <div className="timeline-card observe">
          <div className="timeline" aria-label="Incident status timeline">
            <div className="timeline-connector" aria-hidden="true" />
            {timeline.map(([item, description, status], i) => (
              <div
                className={`timeline-item ${status}`}
                key={item}
                aria-current={status === "current" ? "step" : undefined}
                style={{ "--step-delay": `${150 + i * 90}ms` }}
              >
                <span className="timeline-node">
                  {status === "complete" ? (
                    <Icon name="check" size={15} />
                  ) : (
                    i + 1
                  )}
                </span>
                <div>
                  <strong>{item}</strong>
                  <small>{description}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="alternate-outcomes observe">
          <span className="alternate-heading">Other possible statuses</span>
          <div className="alternate-states" aria-label="Other possible report statuses">
            <div
              className="alternate-status alternate-rejected"
              title="Report did not meet verification requirements."
            >
              <span aria-hidden="true">×</span>
              <div>
                <strong>Rejected</strong>
                <small>Report did not meet verification requirements.</small>
              </div>
            </div>
            <div
              className="alternate-status alternate-info"
              title="Reporter needs to provide more details."
            >
              <span aria-hidden="true">!</span>
              <div>
                <strong>Needs Additional Information</strong>
                <small>Reporter needs to provide more details.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CommunityMap() {
  return (
    <section id="safety-map" className="section map-section">
      <div className="container community-map-layout">
        <div className="map-copy">
          <SectionTitle
            label="Community safety map"
            title="Know what’s happening around your community"
            text="View reported incidents, monitor their status, and understand safety concerns in your area."
          />
          <ul className="check-list">
            <li>
              <Icon name="check" /> Filter by incident category
            </li>
            <li>
              <Icon name="check" /> Track verified status updates
            </li>
            <li>
              <Icon name="check" /> Explore nearby safety concerns
            </li>
          </ul>
          <a className="button" href="#home">
            Explore safety map <Icon name="arrow" size={17} />
          </a>
        </div>
        <div className="community-map-card observe">
          <div className="map-tools">
            <button className="active">All incidents</button>
            <button>Active</button>
            <button>Resolved</button>
          </div>
          <SafetyMap compact />
          <div className="map-legend">
            <span>
              <i className="red" />
              Urgent
            </span>
            <span>
              <i className="orange" />
              Verifying
            </span>
            <span>
              <i className="blue" />
              Assigned
            </span>
            <span>
              <i className="green" />
              Resolved
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function UserRoles() {
  return (
    <section className="section light">
      <div className="container">
        <SectionTitle
          label="Designed for every role"
          title="One community. Shared responsibility."
          text="SafeLink connects everyone involved while keeping each workflow focused and secure."
          centered
        />
        <div className="roles-grid observe">
          {roles.map(([short, title, text], i) => (
            <article className="role" key={title}>
              <span className="role-index">0{i + 1}</span>
              <div className="role-avatar">
                {short.slice(0, 2).toUpperCase()}
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({ end }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (reduced) {
            setValue(end);
            return;
          }
          let start;
          const tick = (t) => {
            start ??= t;
            const p = Math.min((t - start) / 1000, 1);
            setValue(Math.round(end * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [end]);
  return <strong ref={ref}>{value}</strong>;
}
export function Analytics() {
  const stats = [
    [123, "Total reports", "blue"],
    [27, "For verification", "orange"],
    [18, "Responding", "red"],
    [74, "Resolved", "green"],
  ];
  return (
    <section className="section analytics-section">
      <div className="container">
        <div className="analytics-shell observe">
          <div className="analytics-copy">
            <span className="section-label">Safety intelligence</span>
            <h2>Turn local reports into better decisions.</h2>
            <p>
              See trends, response activity, and resolution progress at a
              glance—with focused insights that help teams plan and act.
            </p>
            <a href="#features">
              Discover analytics <Icon name="arrow" size={16} />
            </a>
          </div>
          <div className="dashboard">
            <div className="dashboard-top">
              <div>
                <small>Community overview</small>
                <strong>Safety operations</strong>
              </div>
              <span>Last 30 days</span>
            </div>
            <div className="stat-grid">
              {stats.map(([n, label, color]) => (
                <div className="stat" key={label}>
                  <span className={`stat-dot ${color}`} />
                  <Counter end={n} />
                  <small>{label}</small>
                </div>
              ))}
            </div>
            <div className="chart-box">
              <div className="chart-heading">
                <span>Reports by week</span>
                <small>
                  Resolution rate <b>82%</b>
                </small>
              </div>
              <div className="bar-chart">
                {[38, 52, 45, 66, 58, 78, 62, 84, 72, 91, 76, 87].map(
                  (h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function useReveal(routeKey) {
  useEffect(() => {
    const els = document.querySelectorAll(".observe");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in-view");
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [routeKey]);
}
