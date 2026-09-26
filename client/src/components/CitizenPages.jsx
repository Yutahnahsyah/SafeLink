import { useEffect, useMemo, useRef, useState } from "react";
import CitizenShell from "./CitizenShell";
import Icon from "./Icon";
import SafetyMap from "./SafetyMap";
import LocationPickerMap from "./maps/LocationPickerMap";
import { useAuth } from "../auth";
import { Link, useRouter } from "../routing";
import {
  useCitizenNotifications,
  useCitizenReport,
  useCitizenReports,
  submitCitizenReport,
} from "../citizenData";
import { reverseGeocode } from "../services/reverseGeocode";
import { pangasinanLocations } from "../data/pangasinanLocations";
import ProtectedEvidence from "./ProtectedEvidence";
import { notificationApi } from "../services/safelinkApi";

const statuses = [
  "Submitted",
  "Under Validation",
  "Verified",
  "In Progress",
  "Resolved",
  "Closed",
];
const alternateStatuses = ["Rejected"];
const categories = [
  "Suspicious activities",
  "Missing or vulnerable persons",
  "Harassment or unsafe encounters",
  "Dangerous road incidents",
  "People requiring assistance",
  "Public fire or smoke incidents",
  "People needing assistance during flooding",
];
const reportSteps = ["Details", "Location", "Evidence", "Review"];
const pangasinanBounds = {
  minLatitude: 15.7,
  maxLatitude: 16.7,
  minLongitude: 119.7,
  maxLongitude: 120.8,
};

const statusClass = (status = "") =>
  `citizen-status status-${status.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}`;

function EmptyState({ icon = "report", title, children, action }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={28} />
      {title && <strong>{title}</strong>}
      <p>{children}</p>
      {action}
    </div>
  );
}

function ApiUnavailable({ feature }) {
  return (
    <EmptyState icon="shield" title={`${feature} unavailable`}>
      The current frontend has no configured API endpoint for this feature. No
      placeholder account data is being shown.
    </EmptyState>
  );
}

function ReportTable({ reports }) {
  return (
    <div className="report-table">
      <div className="report-table-head">
        <span>Report</span>
        <span>Submitted</span>
        <span>Location</span>
        <span>Status</span>
        <span>Latest update</span>
        <span />
      </div>
      {reports.map((report) => (
        <div className="report-table-row" key={report.id}>
          <div>
            <strong>{report.type}</strong>
            <small>{report.id}</small>
          </div>
          <span data-label="Submitted">
            {report.submittedAt || report.date}
          </span>
          <span data-label="Location">{report.location}</span>
          <span data-label="Status">
            <b className={statusClass(report.status)}>{report.status}</b>
          </span>
          <span data-label="Latest update">
            {report.latestUpdate || "No update available"}
          </span>
          <Link to={`/citizen/reports/${encodeURIComponent(report.id)}`}>
            View <Icon name="arrow" size={14} />
          </Link>
        </div>
      ))}
    </div>
  );
}

function DepthSurface({ as: Component = "section", className = "", children }) {
  const frame = useRef(null);
  const move = (event) => {
    if (
      window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)")
        .matches
    )
      return;
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      element.style.setProperty("--depth-x", `${(x * 1.2).toFixed(2)}deg`);
      element.style.setProperty("--depth-y", `${(y * -1.2).toFixed(2)}deg`);
      element.style.setProperty(
        "--light-x",
        `${((x + 0.5) * 100).toFixed(0)}%`,
      );
      element.style.setProperty(
        "--light-y",
        `${((y + 0.5) * 100).toFixed(0)}%`,
      );
    });
  };
  const reset = (event) => {
    window.cancelAnimationFrame(frame.current);
    event.currentTarget.style.removeProperty("--depth-x");
    event.currentTarget.style.removeProperty("--depth-y");
    event.currentTarget.style.removeProperty("--light-x");
    event.currentTarget.style.removeProperty("--light-y");
  };
  return (
    <Component
      className={`depth-surface ${className}`}
      onPointerMove={move}
      onPointerLeave={reset}
    >
      {children}
    </Component>
  );
}

function DashboardEmpty({ icon, title, children, action }) {
  return (
    <div className="dashboard-empty">
      <span>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const reportResult = useCitizenReports(user);
  const notificationResult = useCitizenNotifications(user);
  const reports = reportResult.data || [];
  const notifications = notificationResult.data || [];
  const latestReport = reports[0];
  const journeyStages = [
    ["Submitted", ["Submitted"]],
    ["Reviewed", ["Under Validation", "Verified", "Rejected"]],
    ["With responders", ["In Progress"]],
    ["Resolved", ["Resolved", "Closed"]],
  ];
  const journeyIndex = latestReport
    ? Math.max(journeyStages.findIndex(([, statuses]) => statuses.includes(latestReport.status)), 0)
    : -1;
  const firstName = (user?.name || user?.fullName || "Citizen").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <CitizenShell
      title="Community Safety"
      eyebrow={`${greeting}, ${firstName}`}
    >
      <div className="dashboard-command-center">
        <DepthSurface className="command-welcome bento-panel">
          <div className="command-welcome-copy">
            <span className="bento-eyebrow">
              <i /> Your SafeLink companion
            </span>
            <h2>How can we help keep your community safe today?</h2>
            <p>
              Report a concern in a few guided steps, then follow verified updates
              from review through local response.
            </p>
          </div>
          <div className="command-actions" aria-label="Quick actions">
            <Link
              className="command-action command-action--primary"
              to="/citizen/report"
            >
              <span>
                <Icon name="report" />
              </span>
              <div>
                <strong>Report an Incident</strong>
                <small>Start the guided report</small>
              </div>
              <Icon name="arrow" size={16} />
            </Link>
            <Link
              className="command-action command-action--secondary"
              to="/citizen/reports"
            >
              <span>
                <Icon name="history" />
              </span>
              <div>
                <strong>View My Reports</strong>
                <small>Track every update</small>
              </div>
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <i className="command-orbit command-orbit--one" aria-hidden="true" />
          <i className="command-orbit command-orbit--two" aria-hidden="true" />
        </DepthSurface>

        <DepthSurface className="command-map bento-panel">
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">
                <i /> Location intelligence
              </span>
              <h2>Pangasinan Community Safety Map</h2>
              <p>
                Explore generalized community safety locations without exposing
                private reporter information.
              </p>
            </div>
            <Link to="/citizen/safety-map">
              Open Full Map <Icon name="arrow" size={15} />
            </Link>
          </header>
          <div className="command-map-frame">
            <SafetyMap compact />
            <span className="map-data-note">
              <Icon name="shield" size={13} /> Privacy-safe · Authorized live incident feed
            </span>
          </div>
        </DepthSurface>

        <section className="command-activity citizen-journey bento-panel">
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Personal progress</span>
              <h2>Latest Report Status</h2>
            </div>
            <Link to="/citizen/reports">View reports</Link>
          </header>
          {reportResult.available && latestReport ? (
            <div className="citizen-journey-body">
              <Link className="citizen-latest-report" to={`/citizen/reports/${encodeURIComponent(latestReport.id)}`}>
                <span><Icon name="track" size={18} /></span>
                <div>
                  <small>{latestReport.id}</small>
                  <strong>{latestReport.type || latestReport.category || "Community report"}</strong>
                  <p>{latestReport.location || "Location submitted privately"}</p>
                </div>
                <b>{latestReport.status}</b>
                <Icon name="arrow" size={15} />
              </Link>
              <ol className="citizen-journey-steps" aria-label={`Report progress: ${latestReport.status}`}>
                {journeyStages.map(([label], index) => (
                  <li className={index < journeyIndex ? "is-complete" : index === journeyIndex ? "is-current" : ""} key={label}>
                    <span>{index < journeyIndex ? <Icon name="check" size={13} /> : index + 1}</span>
                    <small>{label}</small>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <DashboardEmpty
              icon="history"
              title={
                reportResult.available
                  ? "No activity yet"
                  : "Activity unavailable"
              }
              action={
                <Link to="/citizen/report">
                  Report an incident <Icon name="arrow" size={13} />
                </Link>
              }
            >
              {reportResult.available
                ? "Your report milestones will form a clear timeline here."
                : "Connect the Citizen reports API to show real report milestones."}
            </DashboardEmpty>
          )}
        </section>

        <section className="command-safety bento-panel">
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Helpful guidance</span>
              <h2>Safety Information</h2>
              <p>Simple steps for reporting clearly and getting urgent help.</p>
            </div>
            <Link to="/safety">View safety guide <Icon name="arrow" size={14} /></Link>
          </header>
          <div className="citizen-safety-steps">
            <article><span>1</span><div><strong>Immediate danger?</strong><small>Call emergency services at 911 first.</small></div></article>
            <article><span>2</span><div><strong>Share what happened</strong><small>Add a clear location and only safe evidence.</small></div></article>
            <article><span>3</span><div><strong>Follow verified updates</strong><small>Track your report privately in SafeLink.</small></div></article>
          </div>
        </section>

        <section className="command-notifications bento-panel">
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Status center</span>
              <h2>Latest Updates</h2>
            </div>
            <Link to="/citizen/notifications">View all</Link>
          </header>
          {notificationResult.available && notifications.length ? (
            <div className="command-notification-list">
              {notifications.slice(0, 3).map((item) => (
                <article key={item.id} className={item.unread ? "unread" : ""}>
                  <span>
                    <Icon name="bell" size={16} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <small>{item.timestamp}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <DashboardEmpty
              icon="bell"
              title={
                notificationResult.available
                  ? "You’re all caught up"
                  : "Updates unavailable"
              }
            >
              {notificationResult.available
                ? "Verified report and account updates will appear here."
                : "Connect the notifications API to receive verified status updates."}
            </DashboardEmpty>
          )}
        </section>

        <section className="command-reports bento-panel">
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Private submissions</span>
              <h2>My Recent Reports</h2>
            </div>
            <Link to="/citizen/reports">
              View all <Icon name="arrow" size={14} />
            </Link>
          </header>
          {reportResult.available && reports.length ? (
            <ReportTable reports={reports.slice(0, 3)} />
          ) : (
            <DashboardEmpty
              icon="report"
              title={
                reportResult.available
                  ? "No reports available yet"
                  : "Reports unavailable"
              }
              action={
                <Link className="button" to="/citizen/report">
                  Report an Incident
                </Link>
              }
            >
              {reportResult.available
                ? "Your submitted community safety reports will appear here."
                : "The current frontend has no configured Citizen reports endpoint."}
            </DashboardEmpty>
          )}
        </section>
      </div>
    </CitizenShell>
  );
}

export function MyReportsPage() {
  const { user } = useAuth();
  const result = useCitizenReports(user);
  const reports = result.data || [];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = useMemo(
    () =>
      reports.filter(
        (report) =>
          (status === "All" || report.status === status) &&
          `${report.id} ${report.type} ${report.location}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [reports, query, status],
  );
  return (
    <CitizenShell title="My Reports" eyebrow="Private citizen reports">
      <div className="page-actions">
        <div>
          <h2>Submitted reports</h2>
          <p>Only reports associated with your citizen account appear here.</p>
        </div>
        <Link className="button" to="/citizen/report">
          <Icon name="report" /> New report
        </Link>
      </div>
      <section className="citizen-card">
        <div className="list-filters">
          <label>
            <span className="sr-only">Search reports</span>
            <input
              type="search"
              placeholder="Search ID, type, or location"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {["All", ...statuses, ...alternateStatuses].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        {!result.available ? (
          <ApiUnavailable feature="Citizen reports" />
        ) : filtered.length ? (
          <ReportTable reports={filtered} />
        ) : (
          <EmptyState
            title={reports.length ? "No matching reports" : "No reports yet"}
          >
            {reports.length
              ? "Try changing your search or status filter."
              : "Your submitted reports will appear here."}
          </EmptyState>
        )}
      </section>
    </CitizenShell>
  );
}

export function TrackReportPage({ id }) {
  const { user } = useAuth();
  const result = useCitizenReport(user, id);
  const report = result.data;
  if (result.status === "loading" || result.status === "error")
    return (
      <CitizenShell title="Report details" eyebrow="Incident tracking">
        <section className="citizen-card">
          <EmptyState icon={result.status === "error" ? "priority" : "report"} title={result.status === "error" ? "Unable to load report" : "Loading report"}>
            {result.status === "error" ? result.error?.message || "Please try again." : "Retrieving the latest authorized report details…"}
          </EmptyState>
        </section>
      </CitizenShell>
    );
  if (!result.available)
    return (
      <CitizenShell title="Report details" eyebrow="Incident tracking">
        <section className="citizen-card">
          <ApiUnavailable feature="Report details" />
        </section>
      </CitizenShell>
    );
  if (!report)
    return (
      <CitizenShell title="Report not found">
        <section className="citizen-card">
          <EmptyState title="Report not found">
            This report does not exist or is not available to your account.
          </EmptyState>
        </section>
      </CitizenShell>
    );
  const current = statuses.indexOf(report.status);
  return (
    <CitizenShell title={report.id} eyebrow="Incident tracking">
      <div className="tracking-heading">
        <div>
          <span className={statusClass(report.status)}>{report.status}</span>
          <h2>{report.title || report.type}</h2>
          <p>
            {report.location} · Submitted {report.submittedAt}
          </p>
        </div>
        <Link to="/citizen/reports">Back to reports</Link>
      </div>
      {alternateStatuses.includes(report.status) && (
        <div
          className={`alternate-status-card ${report.status === "Rejected" ? "is-rejected" : ""}`}
        >
          <Icon name={report.status === "Rejected" ? "close" : "priority"} />
          <div>
            <strong>{report.status}</strong>
            <p>
              {report.latestUpdate ||
                "See the latest public update for this report."}
            </p>
          </div>
        </div>
      )}
      <section className="citizen-card tracking-card">
        <h2>Status history</h2>
        <div className="tracking-timeline">
          {statuses.map((stage, index) => {
            const history = report.statusHistory?.find(
              (entry) => entry.status === stage,
            );
            return (
              <div
                className={`${index < current ? "complete" : ""} ${index === current ? "current" : ""}`}
                key={stage}
              >
                <span>
                  {index < current ? (
                    <Icon name="check" size={15} />
                  ) : (
                    index + 1
                  )}
                </span>
                <div>
                  <strong>{stage}</strong>
                  <small>
                    {history?.timestamp ||
                      (index === current
                        ? "Current status"
                        : index < current
                          ? "Completed"
                          : "Awaiting update")}
                  </small>
                  {history?.message && <p>{history.message}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="tracking-grid">
        <section className="citizen-card">
          <h2>Report details</h2>
          <dl className="report-details">
            <div>
              <dt>Reference ID</dt>
              <dd>{report.id}</dd>
            </div>
            <div>
              <dt>Incident type</dt>
              <dd>{report.type}</dd>
            </div>
            <div>
              <dt>Date and time</dt>
              <dd>{report.incidentAt || report.submittedAt}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{report.location}</dd>
            </div>
            {report.agency && (
              <div>
                <dt>Assigned office / agency</dt>
                <dd>{report.agency}</dd>
              </div>
            )}
            <div>
              <dt>Description</dt>
              <dd>{report.description}</dd>
            </div>
          </dl>
          {report.evidence?.length > 0 && (
            <div className="evidence-gallery">
              {report.evidence.map((item) => <ProtectedEvidence incidentId={report.id} item={item} key={item.id} />)}
            </div>
          )}
        </section>
        <aside className="citizen-card privacy-card">
          <Icon name="shield" />
          <h2>Privacy protected</h2>
          <p>
            Only citizen-visible response updates are displayed. Internal
            records and confidential information remain restricted.
          </p>
        </aside>
      </div>
    </CitizenShell>
  );
}

export function ReportIncidentPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const geocodeControllerRef = useRef(null);
  const locationEditRevisionRef = useRef(0);
  const locationIntroPlayedRef = useRef(false);
  const [values, setValues] = useState({
    type: "",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    location: "",
    municipalityOrCity: "",
    barangay: "",
    street: "",
    zipCode: "",
    latitude: "",
    longitude: "",
    files: [],
    details: "",
    confirmed: false,
  });
  const set = (key) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setNotice("");
  };
  const setLocationText = (event) => {
    locationEditRevisionRef.current += 1;
    set("location")(event);
  };
  useEffect(() => () => geocodeControllerRef.current?.abort(), []);
  const findReadableLocation = ({ latitude, longitude }, source) => {
    geocodeControllerRef.current?.abort();
    const controller = new AbortController();
    const editRevision = locationEditRevisionRef.current;
    geocodeControllerRef.current = controller;
    setGeocoding(true);
    setLocationFeedback({ type: "loading", text: "Finding address…" });
    reverseGeocode({ latitude, longitude, signal: controller.signal })
      .then((locationText) => {
        if (controller.signal.aborted) return;
        if (locationEditRevisionRef.current === editRevision) {
          setValues((current) => ({ ...current, location: locationText }));
          setErrors((current) => ({ ...current, location: "" }));
        }
        setLocationFeedback({
          type: "success",
          text:
            source === "current"
              ? "Location detected."
              : "Pinned location updated.",
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setLocationFeedback({
          type: "error",
          text: "We found your location, but couldn't determine the address. You can enter the location or nearby landmark manually.",
        });
      })
      .finally(() => {
        if (geocodeControllerRef.current === controller) setGeocoding(false);
      });
  };
  const setCoordinates = ({ latitude, longitude }, source = "manual") => {
    const inside =
      latitude >= pangasinanBounds.minLatitude &&
      latitude <= pangasinanBounds.maxLatitude &&
      longitude >= pangasinanBounds.minLongitude &&
      longitude <= pangasinanBounds.maxLongitude;
    if (!inside) {
      setErrors((current) => ({ ...current, coordinates: "" }));
      setLocationFeedback({
        type: "error",
        text: "That point is outside Pangasinan. Choose another location on the map.",
      });
      return false;
    }
    setValues((current) => ({
      ...current,
      location: "",
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));
    setErrors((current) => ({ ...current, location: "", coordinates: "" }));
    setSelectionRevision((current) => current + 1);
    findReadableLocation({ latitude, longitude }, source);
    return true;
  };
  const validate = (target = step) => {
    const next = {};
    if (target === 1) {
      if (!values.type) next.type = "Select an incident type.";
      if (values.description.trim().length < 10)
        next.description = "Provide at least 10 characters describing what happened.";
    }
    if (target === 2) {
      if (!values.location.trim())
        next.location = "Enter a location or landmark.";
      if (!values.municipalityOrCity)
        next.municipalityOrCity = "Select a municipality or city.";
      if (!values.barangay.trim()) next.barangay = "Enter the barangay.";
      if (!values.latitude || !values.longitude)
        next.coordinates =
          "Choose the incident position on the map or use your current location.";
    }
    if (target === 4 && !values.confirmed)
      next.confirmed = "Confirm that the report is accurate before submission.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const move = (next) => {
    if (next > step && !validate(step)) return;
    setStep(next);
    setNotice("");
  };
  const useLocation = () => {
    if (!navigator.geolocation) {
      const text =
        "We couldn't detect your current location. Please select the location manually on the map.";
      setErrors((current) => ({ ...current, coordinates: "" }));
      setLocationFeedback({ type: "error", text });
      return;
    }
    setLocating(true);
    setLocationFeedback({
      type: "loading",
      text: "Detecting your current location…",
    });
    setErrors((current) => ({ ...current, coordinates: "" }));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        if (setCoordinates(location, "current"))
          setMapFocus({ ...location, id: Date.now() });
      },
      (error) => {
        setLocating(false);
        const text =
          error.code === 1
            ? "Location access was denied. You can still click the map to select the incident location manually."
            : error.code === 3
              ? "Location detection took too long. Try again or select the location manually."
              : "We couldn't detect your current location. Please select the location manually on the map.";
        setErrors((current) => ({ ...current, coordinates: "" }));
        setLocationFeedback({ type: "error", text });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const addFiles = (event) => {
    const selected = [...event.target.files];
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);
    const invalid = selected.find((file) => !allowed.has(file.type));
    const tooLarge = selected.find((file) => file.size > 20 * 1024 * 1024);
    const tooMany = values.files.length + selected.length > 5;
    if (invalid || tooLarge || tooMany)
      return setErrors((current) => ({
        ...current,
        files: invalid
          ? "Only photo and video files are accepted."
          : tooLarge ? "Each file must be 20 MB or smaller." : "Attach no more than five evidence files.",
      }));
    setValues((current) => ({
      ...current,
      files: [...current.files, ...selected],
    }));
    setErrors((current) => ({ ...current, files: "" }));
  };
  const submit = async () => {
    if (!validate(4)) return;
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const incident = await submitCitizenReport(user, values);
      navigate(`/citizen/reports/${encodeURIComponent(incident.id)}`, { replace: true });
    } catch (error) {
      setNotice(error?.fieldErrors?.[0]?.message || error?.message || "SafeLink couldn't submit this report. Please try again.");
    } finally { setSubmitting(false); }
  };
  return (
    <CitizenShell title="Report Incident" eyebrow={`Step ${step} of 4`}>
      <div className="emergency-notice">
        <Icon name="priority" />
        <div>
          <strong>Immediate danger or a life-threatening emergency?</strong>
          <span>
            Call 911. SafeLink does not replace emergency dispatch services.
          </span>
        </div>
      </div>
      <div className="report-intro">
        <div>
          <h2>{reportSteps[step - 1]}</h2>
          <p>
            Share clear, factual information. Do not put yourself at risk to
            collect evidence.
          </p>
        </div>
        <div
          className="form-progress report-progress"
          aria-label={`Report step ${step} of 4`}
        >
          {reportSteps.map((label, index) => (
            <button
              type="button"
              className={index + 1 <= step ? "active" : ""}
              key={label}
              onClick={() => move(index + 1)}
              aria-current={index + 1 === step ? "step" : undefined}
            >
              <i>{index + 1}</i>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {notice && (
        <p className="form-error" role="alert">
          {notice}
        </p>
      )}
      {step === 1 && (
        <form
          className="incident-form citizen-card"
          onSubmit={(event) => {
            event.preventDefault();
            move(2);
          }}
          noValidate
        >
          <label>
            Incident Type *
            <select
              value={values.type}
              onChange={set("type")}
              aria-invalid={Boolean(errors.type)}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            {errors.type && <small>{errors.type}</small>}
          </label>
          <label>
            Incident Title <span>(optional)</span>
            <input
              value={values.title}
              onChange={set("title")}
              placeholder="Short, descriptive title"
            />
          </label>
          <label className="full">
            Description *
            <textarea
              rows="6"
              value={values.description}
              onChange={set("description")}
              placeholder="What happened? Include useful landmarks and observable conditions."
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && <small>{errors.description}</small>}
          </label>
          <label>
            Date *
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={values.date}
              onChange={set("date")}
            />
            {errors.date && <small>{errors.date}</small>}
          </label>
          <label>
            Time *
            <input type="time" value={values.time} onChange={set("time")} />
            {errors.time && <small>{errors.time}</small>}
          </label>
          <div className="form-footer full">
            <button className="button" type="submit">
              Continue to location <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      )}
      {step === 2 && (
        <form
          className="incident-form citizen-card location-step"
          onSubmit={(event) => {
            event.preventDefault();
            move(3);
          }}
          noValidate
        >
          <label className="full">
            Location / landmark *
            <div className="input-action">
              <input
                value={values.location}
                onChange={setLocationText}
                placeholder="Barangay, municipality, street, or nearby landmark"
                aria-invalid={Boolean(errors.location)}
              />
              <button
                type="button"
                onClick={useLocation}
                disabled={locating || geocoding}
              >
                {locating || geocoding ? (
                  <span className="location-spinner" aria-hidden="true" />
                ) : (
                  <Icon name="crosshair" size={15} />
                )}{" "}
                {locating
                  ? "Detecting location…"
                  : geocoding
                    ? "Finding address…"
                    : "Use current location"}
              </button>
            </div>
            {errors.location && <small>{errors.location}</small>}
          </label>
          <label>
            Municipality / City *
            <select value={values.municipalityOrCity} onChange={set("municipalityOrCity")} aria-invalid={Boolean(errors.municipalityOrCity)}>
              <option value="">Select municipality or city</option>
              {pangasinanLocations.map(({ name }) => <option value={name} key={name}>{name}</option>)}
            </select>
            {errors.municipalityOrCity && <small>{errors.municipalityOrCity}</small>}
          </label>
          <label>
            Barangay *
            <input value={values.barangay} onChange={set("barangay")} autoComplete="address-level3" />
            {errors.barangay && <small>{errors.barangay}</small>}
          </label>
          <label>
            Street / Landmark <span>(optional)</span>
            <input value={values.street} onChange={set("street")} autoComplete="street-address" />
          </label>
          <label>
            ZIP Code <span>(optional)</span>
            <input value={values.zipCode} onChange={set("zipCode")} inputMode="numeric" autoComplete="postal-code" />
          </label>
          <div className="location-picker full">
            <div className="location-picker-heading">
              <span>Map location</span>
              <small>Click the map to pin where the incident happened.</small>
            </div>
            <div className="location-picker-frame">
              <LocationPickerMap
                selectedLocation={
                  values.latitude && values.longitude
                    ? { latitude: values.latitude, longitude: values.longitude }
                    : null
                }
                selectionRevision={selectionRevision}
                focusRequest={mapFocus}
                introPlayedRef={locationIntroPlayedRef}
                onMapClick={(coordinates) =>
                  setCoordinates(coordinates, "manual")
                }
              />
            </div>
            <div className="location-picker-meta">
              <p className="location-picker-help">
                <Icon name="pin" size={14} /> Click or tap anywhere within
                Pangasinan to place or move the pin.
              </p>
              <a
                className="location-geocoder-attribution"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                Address data © OpenStreetMap contributors
              </a>
            </div>
          </div>
          {locationFeedback && (
            <p
              className={`location-feedback full is-${locationFeedback.type}`}
              role="status"
              aria-live="polite"
            >
              {locationFeedback.type === "success" && (
                <Icon name="check" size={16} />
              )}
              {locationFeedback.text}
            </p>
          )}
          <div
            className={`location-coordinates full${values.latitude && values.longitude ? " is-selected" : ""}`}
          >
            <span className="location-coordinate-icon">
              <Icon name="pin" size={18} />
            </span>
            <div>
              <strong>Selected location</strong>
              <span>
                {values.latitude && values.longitude
                  ? "Location pinned"
                  : "No location pinned yet"}
              </span>
              <small>
                {values.latitude && values.longitude
                  ? `${values.latitude}, ${values.longitude}`
                  : "Coordinates will appear after you select the incident location."}
              </small>
            </div>
          </div>
          {errors.coordinates && (
            <small className="full field-error">{errors.coordinates}</small>
          )}
          <div className="form-footer full">
            <button
              className="button button-muted"
              type="button"
              onClick={() => move(1)}
            >
              Back
            </button>
            <button className="button" type="submit">
              Continue to evidence <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      )}
      {step === 3 && (
        <section className="incident-form citizen-card">
          <label className="full upload-field upload-dropzone">
            <span>
              <Icon name="camera" /> Add supporting photos or videos
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={addFiles}
            />
            <small>
              Optional · Up to 5 files, 20 MB each. JPEG, PNG, WebP, MP4, WebM, or MOV.
            </small>
            {errors.files && <small>{errors.files}</small>}
          </label>
          {values.files.length > 0 && (
            <div className="evidence-list full">
              {values.files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <Icon
                    name={file.type.startsWith("image/") ? "camera" : "report"}
                    size={18}
                  />
                  <span>
                    <strong>{file.name}</strong>
                    <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        files: current.files.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    aria-label={`Remove ${file.name}`}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="full">
            Additional details <span>(optional)</span>
            <textarea
              rows="4"
              value={values.details}
              onChange={set("details")}
              placeholder="Accessibility concerns, directions, or other useful context"
            />
          </label>
          <div className="form-footer full">
            <button
              className="button button-muted"
              type="button"
              onClick={() => move(2)}
            >
              Back
            </button>
            <button className="button" type="button" onClick={() => move(4)}>
              Review report <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      )}
      {step === 4 && (
        <section className="citizen-card review-report">
          <dl>
            <div>
              <dt>Incident</dt>
              <dd>
                {values.title || values.type}
                <br />
                <small>{values.type}</small>
              </dd>
            </div>
            <div>
              <dt>Date and time</dt>
              <dd>
                {values.date} · {values.time}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {values.location}
                <br />
                {values.latitude}, {values.longitude}
              </dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>
                {values.files.length
                  ? `${values.files.length} file(s) selected`
                  : "No files selected"}
              </dd>
            </div>
            <div className="full">
              <dt>Description</dt>
              <dd>{values.description}</dd>
            </div>
          </dl>
          <label className="confirm-row">
            <input
              type="checkbox"
              checked={values.confirmed}
              onChange={set("confirmed")}
            />{" "}
            I confirm that this information is accurate to the best of my
            knowledge.
          </label>
          {errors.confirmed && (
            <small className="field-error">{errors.confirmed}</small>
          )}
          <div className="emergency-notice emergency-notice--compact">
            <Icon name="priority" />
            <span>
              If there is immediate danger or a life-threatening emergency, call
              911. SafeLink does not replace emergency dispatch services.
            </span>
          </div>
          <div className="form-footer">
            <button
              className="button button-muted"
              type="button"
              onClick={() => move(3)}
            >
              Back
            </button>
            <button className="button" type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"} <Icon name="check" size={16} />
            </button>
          </div>
        </section>
      )}
    </CitizenShell>
  );
}

export function CitizenMapPage() {
  const [filters, setFilters] = useState({ category: "all", status: "all" });
  const set = (key) => (event) =>
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <CitizenShell
      title="Pangasinan Safety Map"
      eyebrow="Privacy-protected community view"
    >
      <div className="page-actions">
        <div>
          <h2>Community safety overview</h2>
          <p>
            Generalized locations only. Reporter identities, contact details,
            and evidence are never shown.
          </p>
        </div>
      </div>
      <p className="data-disclosure" role="note">
        <Icon name="shield" size={17} /> The map shows privacy-safe incident
        markers returned for your authorized account. Reporter identities and evidence are excluded.
      </p>
      <section className="citizen-card map-page-card">
        <div className="map-page-filters">
          <select
            value={filters.category}
            onChange={set("category")}
            aria-label="Filter incidents by category"
          >
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={set("status")}
            aria-label="Filter incidents by status"
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <div className="map-legend" aria-label="Map legend">
            <span>
              <i className="legend-active" /> Active / under review
            </span>
            <span>
              <i className="legend-resolved" /> Resolved
            </span>
          </div>
        </div>
        <div className="citizen-map-large">
          <SafetyMap
            compact
            filterCategory={filters.category}
            filterStatus={filters.status}
          />
        </div>
      </section>
    </CitizenShell>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const result = useCitizenNotifications(user);
  const items = result.data || [];
  const [notificationError, setNotificationError] = useState("");
  const markAllRead = async () => {
    setNotificationError("");
    try { await notificationApi.markAllRead(); result.retry(); }
    catch (error) { setNotificationError(error?.message || "Unable to update notifications."); }
  };
  const markRead = (item) => {
    if (item.unread) notificationApi.markRead(item.id).catch((error) => setNotificationError(error?.message || "Unable to update this notification."));
  };
  return (
    <CitizenShell title="Notifications" eyebrow="Report and account updates">
      <div className="page-actions">
        <div>
          <h2>Your updates</h2>
          <p>
            Report status, information requests, and account security notices.
          </p>
        </div>
        {items.some((item) => item.unread) && <button className="button button-muted" onClick={markAllRead}>Mark all as read</button>}
      </div>
      {notificationError && <p className="form-error" role="alert">{notificationError}</p>}
      <section className="citizen-card notification-list">
        {!result.available ? (
          <ApiUnavailable feature="Notifications" />
        ) : items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              className={item.unread ? "unread" : ""}
              onClick={() => markRead(item)}
              to={
                item.reportId
                  ? `/citizen/reports/${encodeURIComponent(item.reportId)}`
                  : "/citizen/notifications"
              }
            >
              <span>
                <Icon name={item.type === "resolved" ? "check" : "bell"} />
                {item.unread && <i />}
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{item.timestamp}</small>
              </div>
            </Link>
          ))
        ) : (
          <EmptyState icon="bell" title="You’re all caught up">
            New report and account updates will appear here.
          </EmptyState>
        )}
      </section>
    </CitizenShell>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const name = user?.name || user?.fullName || "Citizen";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <CitizenShell title="Profile" eyebrow="Personal information">
      <section className="profile-hero citizen-card">
        <div className="profile-photo">
          <span>{initials}</span>
        </div>
        <div className="profile-identity">
          <span>Citizen account</span>
          <h2>{name}</h2>
          <p>Your SafeLink identity and community information.</p>
          <b
            className={
              user?.emailVerified ? "verification verified" : "verification"
            }
          >
            <Icon name={user?.emailVerified ? "check" : "shield"} size={14} />
            {user?.emailVerified
              ? "Email verified"
              : "Verification not available"}
          </b>
        </div>
      </section>
      <div className="profile-sections">
        <section className="citizen-card profile-info-section">
          <header>
            <span>
              <Icon name="users" />
            </span>
            <div>
              <small>Identity</small>
              <h2>Personal information</h2>
            </div>
          </header>
          <dl>
            <div>
              <dt>Full Name</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || "Not available"}</dd>
            </div>
            <div>
              <dt>Contact Number</dt>
              <dd>{user?.contactNumber || user?.contact || "Not available"}</dd>
            </div>
          </dl>
        </section>
        <section className="citizen-card profile-info-section">
          <header>
            <span>
              <Icon name="pin" />
            </span>
            <div>
              <small>Community</small>
              <h2>Location information</h2>
            </div>
          </header>
          <dl>
            <div>
              <dt>City / Municipality</dt>
              <dd>{user?.city || user?.municipality || "Not available"}</dd>
            </div>
            <div>
              <dt>Barangay</dt>
              <dd>{user?.barangay || "Not available"}</dd>
            </div>
          </dl>
        </section>
      </div>
      <p className="profile-capability-note">
        <Icon name="shield" size={16} /> Profile editing will be available when
        the frontend is connected to a supported profile update endpoint.
      </p>
    </CitizenShell>
  );
}

export function SettingsPage() {
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const doLogout = () => {
    logout();
    navigate("/login/citizen", { replace: true });
  };
  const sections = [
    [
      "shield",
      "Security",
      "Account & Password",
      "Password changes are not exposed by the current frontend API. Request a secure reset email using the supported recovery flow.",
      <Link className="button button-muted" to="/forgot-password">
        Reset password
      </Link>,
    ],
    [
      "bell",
      "Updates",
      "Notification Preferences",
      "Preferences will appear here when the backend exposes supported delivery channels. No non-functional switches are displayed.",
    ],
    [
      "users",
      "Privacy",
      "Data & Privacy",
      "Your identity, contact details, exact confidential information, and evidence are never included in public map entries.",
    ],
  ];
  return (
    <CitizenShell title="Settings" eyebrow="Account, privacy, and security">
      <div className="settings-intro">
        <div>
          <span>Citizen preferences</span>
          <h2>Keep your account secure and your information protected.</h2>
        </div>
        <Icon name="shield" size={30} />
      </div>
      <div className="settings-grid">
        {sections.map(([icon, eyebrow, title, description, action]) => (
          <section className="citizen-card settings-card" key={title}>
            <span>
              <Icon name={icon} />
            </span>
            <div>
              <small>{eyebrow}</small>
              <h2>{title}</h2>
              <p>{description}</p>
              {action}
            </div>
          </section>
        ))}
        <section className="citizen-card settings-card settings-card--logout">
          <span>
            <Icon name="arrow" />
          </span>
          <div>
            <small>Session</small>
            <h2>Sign Out</h2>
            <p>End your current SafeLink session on this device.</p>
            <button
              className="button danger-button"
              type="button"
              onClick={doLogout}
            >
              Logout
            </button>
          </div>
        </section>
      </div> bambiyaaa kooo
    </CitizenShell>
  );
}
