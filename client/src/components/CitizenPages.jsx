import { SectionSkeleton, ResourceError, RefreshNotice } from './PageSkeletons';
import { ChangePasswordModal } from "./ChangePasswordForm";
import MfaSettingsCard from "./MfaSettingsCard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CitizenShell from "./CitizenShell";
import Icon from "./Icon";
import FieldRequirement from "./FieldRequirement";
import { OpenNotificationsButton } from "./NotificationBell";
import SafetyMap from "./SafetyMap";
import SafeLinkMap from "./maps/SafeLinkMap";
import LocationPickerMap from "./maps/LocationPickerMap";
import { useAuth } from "../auth";
import { Link, useRouter } from "../routing";
import {
  useCitizenNotifications,
  useCitizenReport,
  useCitizenReports,
  submitCitizenReport,
} from "../citizenData";
import { useIncidentLocation } from "../services/useIncidentLocation";
import { useRegistrationLocations } from "../services/useRegistrationLocations";
import { pangasinanLocations } from "../data/pangasinanLocations";
import { COMMUNITY_MARKER_COLORS, isVisibleCommunityIncident } from "../services/communityIncidentMarkers";
import ProtectedEvidence from "./ProtectedEvidence";
import LogoutConfirmDialog from "./LogoutConfirmDialog";
import { incidentApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";
import "./CitizenMap.css";
import "./CitizenDashboard.css";
import "./LguModule.css";

const statuses = [
  "Submitted",
  "Under Barangay Review",
  "Verified",
  "In Progress",
  "Resolved",
  "Closed",
];
const timelineLabels = {
  Submitted: "Citizen report submitted",
  "Under Barangay Review": "Barangay review",
  Verified: "Report verified",
  "In Progress": "Response in progress",
  Resolved: "Resolved",
  Closed: "Closed",
};
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
    ["Barangay review", ["Under Barangay Review", "Verified", "Rejected"]],
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
      className="citizen-dashboard"
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

        <section className="command-activity citizen-journey bento-panel"><RefreshNotice result={reportResult} />
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Personal progress</span>
              <h2>Latest Report Status</h2>
            </div>
            <Link to="/citizen/reports">View reports</Link>
          </header>
          {reportResult.status === "loading" ? <SectionSkeleton variant="list" label="Loading report progress" /> : reportResult.status === "error" ? <ResourceError result={reportResult} label="Could not load report progress." /> : reportResult.available && latestReport ? (
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

        <section className="command-notifications bento-panel"><RefreshNotice result={notificationResult} />
          <header className="bento-header">
            <div>
              <span className="bento-eyebrow">Status center</span>
              <h2>Latest Updates</h2>
            </div>
            <OpenNotificationsButton>View all</OpenNotificationsButton>
          </header>
          {notificationResult.status === "loading" ? <SectionSkeleton variant="list" label="Loading latest updates" /> : notificationResult.status === "error" ? <ResourceError result={notificationResult} /> : notificationResult.available && notifications.length ? (
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
              {reportResult.status === 'success' && <p className="citizen-report-counts" aria-live="polite">{reports.length} reports · {reports.filter((report) => !['Resolved', 'Closed', 'Rejected'].includes(report.status)).length} active · {reports.filter((report) => ['Resolved', 'Closed'].includes(report.status)).length} resolved</p>}
            </div>
            <Link to="/citizen/reports">
              View all <Icon name="arrow" size={14} />
            </Link>
          </header>
          {reportResult.status === 'loading' ? <SectionSkeleton variant="table" rows={3} columns={6} label="Loading recent reports" /> : reportResult.status === 'error' ? <ResourceError result={reportResult} label="Could not load recent reports." /> : reportResult.available && reports.length ? (
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
        <RefreshNotice result={result} />{result.status === "loading" ? <SectionSkeleton variant="table" rows={5} columns={6} label="Loading citizen reports" /> : result.status === "error" ? <ResourceError result={result} /> : !result.available ? (
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
          {result.status === "loading" ? <SectionSkeleton variant="form" label="Loading report details" /> : <ResourceError result={result} label="Unable to load report." />}
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
    <CitizenShell title={report.title || report.type || "Incident"} eyebrow={report.id} className="citizen-report-tracking">
      <div className="lgu-case-header citizen-case-header">
        <div>
          <span className={statusClass(report.status)}>{report.status}</span>
          <h2>{report.title || report.type}</h2>
          <p>
            {report.location} · Submitted {report.submittedAt}
          </p>
        </div>
        <Link to="/citizen/reports">Back to reports</Link>
      </div>
      {result.refreshError && <RefreshNotice result={result} />}
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
      {['Resolved', 'Closed'].includes(report.status) && <section className="citizen-card citizen-resolution-panel resolution-outcome">
        <header><h2>Resolution outcome</h2></header><p>{report.resolution?.message || 'No resolution remarks were recorded for this older report.'}</p>
        {report.resolution?.timestamp && <time>{report.resolution.timestamp}</time>}
      </section>}
      <div className="lgu-case-layout citizen-case-layout">
        <section className="citizen-card lgu-case-overview citizen-report-overview">
          <header><h2>Incident Overview</h2></header>
          <dl className="report-details">
            <div><dt>Reference ID</dt><dd>{report.id}</dd></div>
            <div><dt>Incident type</dt><dd>{report.type}</dd></div>
            <div><dt>Suggested urgency</dt><dd>{report.citizenUrgency || "Not recorded"}</dd></div>
            <div><dt>Official priority</dt><dd>{report.priority}{report.priorityConfirmed ? " — confirmed by Barangay" : " — awaiting Barangay confirmation"}</dd></div>
            <div><dt>Date and time</dt><dd>{report.incidentAt || report.submittedAt}</dd></div>
            <div><dt>Location</dt><dd>{report.location}</dd></div>
            {report.agency && <div><dt>Assigned office / agency</dt><dd>{report.agency}</dd></div>}
            <div><dt>Description</dt><dd>{report.description}</dd></div>
          </dl>
        </section>
        <aside className="citizen-card lgu-assignment-card citizen-report-privacy">
          <header><h2>Report visibility</h2></header>
          <dl><div><dt>Current status</dt><dd>{report.status}</dd></div><div><dt>Assigned office / agency</dt><dd>{report.agency || "Awaiting assignment"}</dd></div></dl>
          <p className="lgu-assignment-note"><Icon name="shield" size={14} /> Only citizen-visible response updates are displayed. Internal records and confidential information remain restricted.</p>
        </aside>
        <section className="citizen-card lgu-timeline-card">
          <header><h2>Response Timeline</h2></header>
          <div className="lgu-timeline">
          {statuses.map((stage, index) => {
            const history = report.statusHistory?.findLast((entry) => entry.status === stage && ['submitted', 'status_changed'].includes(entry.eventType))
              || report.statusHistory?.findLast((entry) => entry.status === stage);
            const complete = index < current || Boolean(history);
            return (
              <div
                className={`${complete ? "is-complete" : ""} ${index === current ? "is-current" : ""}`}
                key={stage}
              >
                <span>
                  {complete ? (
                    <Icon name="check" size={15} />
                  ) : (
                    index + 1
                  )}
                </span>
                <div>
                  <strong>{timelineLabels[stage]}</strong>
                  <small>
                    {history?.timestamp ||
                      (index === current
                        ? "Current stage"
                        : complete
                          ? "Completed"
                          : "Pending")}
                  </small>
                  {history?.message && <p>{history.message}</p>}
                </div>
              </div>
            );
          })}
          </div>
        </section>
        <section className="citizen-card lgu-evidence-card citizen-evidence-card"><header><h2>Evidence</h2></header>{report.evidence?.length ? <div className="lgu-evidence-grid">{report.evidence.map((item) => <ProtectedEvidence incidentId={report.id} item={item} key={item.id} />)}</div> : <p className="citizen-evidence-empty">No evidence files were attached to this report.</p>}</section>
        <section className="citizen-card lgu-updates-card"><header><div><h2>Response Updates</h2><p>Progress updates for your report.</p></div></header>{report.statusHistory?.length ? <div className="lgu-update-list">{report.statusHistory.map((entry, index) => <article key={entry.id || index}><span><Icon name="check" size={14} /></span><div><strong>{entry.status}</strong>{entry.message && <p>{entry.message}</p>}<small>{entry.timestamp || 'Time not recorded'}</small></div></article>)}</div> : <p className="citizen-updates-empty">No response updates recorded.</p>}</section>
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
  const locationIntroPlayedRef = useRef(false);
  const [values, setValues] = useState({
    type: "",
    citizenUrgency: "",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    location: "",
    municipalityOrCity: "",
    barangay: "",
    street: "",
    zipCode: "",
    province: "",
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
  const { locating, geocoding, locationFeedback, mapFocus, selectionRevision, useLocation, setCoordinates, editAddress, setMunicipality, confirmPin, coordinateError } =
    useIncidentLocation({ values, setValues, setErrors, setNotice });
  const barangays = useRegistrationLocations('barangays', values.municipalityOrCity);
  const validate = (target = step) => {
    const next = {};
    if (target === 1) {
      if (!values.type) next.type = "Select an incident type.";
      if (!values.citizenUrgency) next.citizenUrgency = "Suggest how urgently the report needs attention.";
      if (values.description.trim().length < 10)
        next.description = "Provide at least 10 characters describing what happened.";
    }
    if (target === 2) {
      if (!values.location.trim())
        next.location = "Enter a location or landmark.";
      if (!values.municipalityOrCity)
        next.municipalityOrCity = "Select a municipality or city.";
      if (!values.barangay.trim()) next.barangay = "Enter the barangay.";
      if (values.zipCode && !/^\d{4}$/.test(values.zipCode)) next.zipCode = "Enter a four-digit ZIP code or leave it blank.";
      if (!values.latitude || !values.longitude)
        next.coordinates =
          "Choose the incident position on the map or use your current location.";
      else {
        const boundaryError = coordinateError();
        if (boundaryError) next.coordinates = boundaryError;
      }
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
            <span className="field-label-row">Incident Type<FieldRequirement /></span>
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
            <span className="field-label-row">Incident Title<FieldRequirement optional /></span>
            <input
              value={values.title}
              onChange={set("title")}
              placeholder="Short, descriptive title"
            />
          </label>
          <label>
            <span className="field-label-row">Suggested urgency<FieldRequirement /></span>
            <select
              value={values.citizenUrgency}
              onChange={set("citizenUrgency")}
              aria-invalid={Boolean(errors.citizenUrgency)}
            >
              <option value="">How urgent is this?</option>
              <option value="Low">Low — no immediate response needed</option>
              <option value="Medium">Medium — needs community attention</option>
              <option value="High">High — needs prompt review</option>
            </select>
            <small>Barangay personnel will confirm the official priority after review.</small>
            {errors.citizenUrgency && <small>{errors.citizenUrgency}</small>}
          </label>
          <label className="full">
            <span className="field-label-row">Description<FieldRequirement /></span>
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
            <span className="field-label-row">Date of Incident<FieldRequirement optional /></span>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={values.date}
              onChange={set("date")}
            />
            {errors.date && <small>{errors.date}</small>}
          </label>
          <label>
            <span className="field-label-row">Time of Incident<FieldRequirement optional /></span>
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
            <span className="field-label-row">Nearby landmark or location details<FieldRequirement /></span>
            <div className="input-action">
              <input
                value={values.location}
                onChange={editAddress("location")}
                placeholder="Nearby landmark, street, or other useful location detail"
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
            <span className="location-picker-help">Current location and map clicks automatically detect the address. Moving the pin revalidates its details; confirm any missing fields before continuing.</span>
            {errors.location && <small>{errors.location}</small>}
          </label>
          <label>
            <span className="field-label-row">Municipality / City<FieldRequirement /></span>
            <select value={values.municipalityOrCity} onChange={setMunicipality} aria-invalid={Boolean(errors.municipalityOrCity)}>
              <option value="">Select municipality or city</option>
              {pangasinanLocations.map(({ name }) => <option value={name} key={name}>{name}</option>)}
            </select>
            {errors.municipalityOrCity && <small>{errors.municipalityOrCity}</small>}
          </label>
          <label>
            <span className="field-label-row">Barangay<FieldRequirement /></span>
            {barangays.status === "error" ? <>
              <input value={values.barangay} onChange={editAddress("barangay")} autoComplete="address-level3" aria-invalid={Boolean(errors.barangay)} />
              <small>Barangay options are unavailable. Enter the barangay manually, or <button type="button" onClick={barangays.retry}>retry loading options</button>.</small>
            </> : <select value={values.barangay} onChange={editAddress("barangay")} disabled={!values.municipalityOrCity || barangays.status === "loading"} aria-invalid={Boolean(errors.barangay)}>
              <option value="">{barangays.status === "loading" ? "Loading barangays…" : "Select barangay"}</option>
              {barangays.data.map(({ name }) => <option value={name} key={name}>{name}</option>)}
            </select>}
            {errors.barangay && <small>{errors.barangay}</small>}
          </label>
          <label>
            <span className="field-label-row">Street<FieldRequirement optional /></span>
            <input value={values.street} onChange={editAddress("street")} autoComplete="street-address" />
          </label>
          <label>
            <span className="field-label-row">ZIP Code<FieldRequirement>Auto-filled</FieldRequirement></span>
            <input value={values.zipCode} onChange={editAddress("zipCode")} inputMode="numeric" maxLength={4} autoComplete="postal-code" aria-invalid={Boolean(errors.zipCode)} />
            {errors.zipCode && <small>{errors.zipCode}</small>}
          </label>
          <div className="location-picker full">
            <div className="location-picker-heading">
              <span>Map location</span>
              <small>Click the map to update the pin and detected address.</small>
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
              <a className="location-geocoder-attribution" href="https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/" target="_blank" rel="noreferrer">
                Municipal boundaries: geoBoundaries / NAMRIA, PSA, OCHA (CC BY 3.0 IGO)
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
                  ? `Location pinned${values.province ? ` · ${values.province}` : ''}`
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
          {values.pinNeedsConfirmation && values.latitude && values.longitude && (
            <button className="button button-muted" type="button" onClick={confirmPin}>
              Confirm this pin for the selected barangay
            </button>
          )}
          <div className="form-footer full">
            <button
              className="button button-muted"
              type="button"
              onClick={() => move(1)}
            >
              Back
            </button>
            <button className="button" type="submit" disabled={locating || geocoding}>
              Continue to evidence <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      )}
      {step === 3 && (
        <section className="incident-form citizen-card">
          <label className="full upload-field upload-dropzone">
            <span>
              <Icon name="camera" /> Add supporting photos or videos <FieldRequirement optional />
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
            <span className="field-label-row">Additional details<FieldRequirement optional /></span>
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
              <dt>Suggested urgency</dt>
              <dd>{values.citizenUrgency}</dd>
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
  const { user } = useAuth();
  const [filters, setFilters] = useState({ category: "", status: "", municipality: "", period: "30", from: "", to: "" });
  const [mapVersion, setMapVersion] = useState(0);
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = useMemo(() => {
    const values = { incidentType: filters.category, status: filters.status, municipality: filters.municipality };
    if (filters.period === "custom") { values.from = filters.from; values.to = filters.to; }
    else if (filters.period !== "all") {
      const date = new Date(Date.now() - (Number(filters.period) - 1) * 86400000);
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
      values.from = `${parts.year}-${parts.month}-${parts.day}`;
    }
    return values;
  }, [filters]);
  const loadMap = useCallback(() => incidentApi.map(query), [query]);
  const result = useApiResource(loadMap, [user?.id, query], { enabled: Boolean(user?.id), initialData: { items: [], metadata: null } });
  const items = result.status === "success" && !result.refreshError ? (result.data?.items || []).filter(isVisibleCommunityIncident) : [];
  const summary = result.data?.metadata;
  const clearFilters = () => setFilters({ category: "", status: "", municipality: "", period: "30", from: "", to: "" });
  return (
    <CitizenShell
      title="Community Safety Map"
      eyebrow="Published community activity"
    >
      <div className="page-actions community-map-heading">
        <div>
          <h2>Community Safety Map</h2>
          <p>Explore reported community safety incidents across Pangasinan.</p>
        </div>
      </div>
      <p className="data-disclosure" role="note"><Icon name="shield" size={17} /> Only approved resolved reports appear at generalized locations. Exact locations, reporter details, and evidence stay private.</p>
      <section className="community-map-stats" aria-label="Published report summary">
        {[["Publicly Visible Reports", summary?.visibleReports], ["Active Reports", summary?.activeReports], ["Resolved Reports", summary?.resolvedReports], ["Municipalities With Published Reports", summary?.municipalities]].map(([label, value]) => <div className="citizen-card" key={label}><small>{label}</small><strong>{result.status === "loading" ? "…" : value === null && summary ? "—" : value ?? 0}</strong></div>)}
      </section>
      <section className="citizen-card map-page-card community-map-page">
        <div className="community-map-filters" aria-label="Community map filters">
          <label>Category<select value={filters.category} onChange={set("category")}><option value="">All Categories</option>{["Suspicious activities", "Dangerous road incidents", "Public fire or smoke incidents"].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={set("status")}><option value="">All Statuses</option>{["Verified", "In Progress", "Resolved", "Closed"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Municipality or City<select value={filters.municipality} onChange={set("municipality")}><option value="">All Municipalities</option>{pangasinanLocations.map((place) => <option key={place.name}>{place.name}</option>)}</select></label>
          <label>Date reported<select value={filters.period} onChange={set("period")}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="custom">Custom Date Range</option><option value="all">All Dates</option></select></label>
          {filters.period === "custom" && <><label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={set("from")} /></label><label>To<input type="date" value={filters.to} min={filters.from || undefined} onChange={set("to")} /></label></>}
          <button className="button button-muted" type="button" onClick={clearFilters}>Clear Filters</button>
          <button className="button button-muted" type="button" onClick={() => setMapVersion((value) => value + 1)}>Reset Map View</button>
        </div>
        {result.status === "error" && <div className="community-map-state" role="alert">Community map data could not be loaded. <button type="button" className="button" onClick={result.retry}>Retry</button></div>}
        {result.status === "loading" && <div className="community-map-state" role="status"><span className="skeleton-block" /> Loading published reports…</div>}
        {result.status === "success" && !items.length && <div className="community-map-state" role="status">No approved resolved reports match the current filters.</div>}
        <div className="citizen-map-large">
          <SafeLinkMap key={mapVersion} mode="community" items={items} compact />
        </div>
        <div className="community-map-legend" aria-label="Map legend">{[
          ["Suspicious activities", "", COMMUNITY_MARKER_COLORS.suspicious],
          ["Road incidents", "is-road", COMMUNITY_MARKER_COLORS.road],
          ["Fire or smoke", "is-fire", COMMUNITY_MARKER_COLORS.fire],
          ["Mixed categories", "is-mixed", COMMUNITY_MARKER_COLORS.mixed],
          ["Multiple nearby areas", "is-cluster", COMMUNITY_MARKER_COLORS.nearby],
        ].map(([label, className, color]) => <span key={label}><i className={`community-legend-dot ${className}`} style={{ backgroundColor: color }} /> {label}</span>)}<small>Colors show incident categories. Select a circle to browse every resolved report in its generalized area.</small></div>
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
              <dd>{user?.address?.municipalityOrCity || user?.city || user?.municipality || "Not available"}</dd>
            </div>
            <div>
              <dt>Barangay</dt>
              <dd>{user?.address?.barangay || user?.barangay || "Not available"}</dd>
            </div>
            <div><dt>Residential Street Address</dt><dd>{user?.address?.street || "Not provided"}</dd></div>
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
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const sections = [
    [
      "shield",
      "Security",
      "Account & Password",
      "Update your password securely from this account setting.",
      <div className="settings-card-actions"><button className="button button-muted" type="button" onClick={() => setPasswordModalOpen(true)}>Change password</button></div>,
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
        <MfaSettingsCard />
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
              onClick={() => setLogoutConfirmOpen(true)}
            >
              Logout
            </button>
          </div>
        </section>
      </div>
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
      <LogoutConfirmDialog open={logoutConfirmOpen} onCancel={() => setLogoutConfirmOpen(false)} onConfirm={doLogout} />
    </CitizenShell>
  );
}
