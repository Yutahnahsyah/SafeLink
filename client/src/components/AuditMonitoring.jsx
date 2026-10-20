import { useEffect, useRef, useState } from "react";
import { useAuditLogs } from "../adminData";
import { auditApi } from "../services/safelinkApi";
import Icon from "./Icon";
import { auditEvents, auditPresentation, auditRoles, auditTime, dateBoundary } from "./auditPresentation";
import "./AuditMonitoring.css";
import { SectionSkeleton, SkeletonTableRows, RefreshNotice } from './PageSkeletons';

function ResultBadge({ value }) {
  return <span className={"audit-result " + (value === "failure" ? "is-failure" : "")}>{value === "failure" ? "Failed" : value === "success" ? "Successful" : "Recorded"}</span>;
}
function FeedState({ result, table = false }) {
  if (!result.available) return <p className="audit-empty">Sign in with an administrator account to view recorded activity.</p>;
  if (result.status === "loading" && !result.data) return table ? <span className="sr-only" role="status" aria-label="Loading audit records">Loading audit records</span> : <SectionSkeleton variant="list" label="Loading audit events" />;
  if (result.status === "error") return <div className="audit-error" role="alert"><span>{result.error?.status === 401 ? "Your session expired. Sign in again." : result.error?.status === 403 ? "Administrator access is required." : "Activity could not be refreshed. Previously loaded records may be out of date."}</span><button type="button" onClick={result.retry}>Retry</button></div>;
  return null;
}
export function RecentAuditEvents({ result }) {
  const events = result.data?.data || [];
  return <div className="audit-recent">
    <p className="audit-refresh-note">Refreshes every 15 seconds while this page is visible · Philippine time</p>
    <FeedState result={result} />
    {events.map((event) => {
      const view = auditPresentation(event);
      return <article className="audit-recent-row" key={event._id}>
        <span className={"audit-event-icon " + (event.outcome === "failure" ? "is-failure" : "")}><Icon name={view.icon} size={20} /></span>
        <div><strong>{view.title}</strong><p>{view.actor} · {view.role}</p><p>{view.description}</p><time dateTime={event.createdAt}>{auditTime(event.createdAt)}</time></div>
        <ResultBadge value={event.outcome} />
      </article>;
    })}
    {result.status === "success" && !events.length && <p className="audit-empty">No audit events have been recorded yet.</p>}
  </div>;
}
function AuditDetails({ id, onClose }) {
  const dialog = useRef(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ event: null, error: null });
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ event: null, error: null });
    auditApi.detail(id, { signal: controller.signal }).then((event) => setState({ event, error: null })).catch((error) => {
      if (error.name !== "AbortError") setState({ event: null, error });
    });
    return () => controller.abort();
  }, [id, revision]);
  const event = state.event;
  const view = event && auditPresentation(event);
  return <dialog ref={dialog} className="audit-dialog" aria-labelledby="audit-detail-title" onCancel={onClose}>
    <header><h2 id="audit-detail-title">Audit event details</h2><button type="button" onClick={onClose} autoFocus aria-label="Close event details">Close</button></header>
    {state.error ? <div role="alert"><p>Could not load this event.</p><button onClick={() => setRevision((value) => value + 1)}>Retry</button></div> : !event ? <p role="status">Loading event…</p> : <>
      <h3>{view.title}</h3><ResultBadge value={event.outcome} />
      <dl>{[
        ["Event ID", event._id], ["Event code", event.action], ["Actor", view.actor], ["Actor reference", event.actorId || "Unavailable"],
        ["Role", view.role], ["Philippine time", auditTime(event.createdAt, true)], ["UTC timestamp", event.createdAt],
        ["Related resource", view.resource], ["Description", view.description], ["Request ID", event.requestId || "Not recorded for this historical event"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
      <h3>Operational metadata</h3>
      {Object.keys(event.details || {}).length ? <dl>{Object.entries(event.details).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value ?? "—")}</dd></div>)}</dl> : <p>No additional metadata recorded.</p>}
    </>}
  </dialog>;
}
const initialFilters = { search: "", role: "", action: "", outcome: "", from: "", to: "", sort: "desc" };
export function AuditLogsView({ user }) {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [filterError, setFilterError] = useState("");
  const result = useAuditLogs(user, { ...filters, from: dateBoundary(filters.from), to: dateBoundary(filters.to, true), page, limit: 25 });
  const rows = result.data?.data || [];
  const pagination = result.data?.pagination;
  const summary = result.data?.summary;
  const update = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  const apply = (event) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) { setFilterError("Start date must be on or before end date."); return; }
    setFilterError(""); setPage(1); setFilters({ ...draft });
  };
  return <div className="audit-monitor">
    <div className="audit-page-intro"><div><h2>System activity and accountability</h2><p>Backend-recorded activity across SafeLink. Times shown in Asia/Manila.</p></div><button type="button" disabled={result.refreshing} onClick={result.retry}>Refresh now</button></div>
    <div className="audit-metrics">{[
      ["Total events", "total"], ["Authentication events", "authentication"], ["Incident activities", "incidents"],
      ["Administrative activities", "administration"], ["Failed sign-in attempts", "failedAuthentication"],
    ].map(([label, key]) => <section key={key}><span>{label}</span><strong>{summary ? Number(summary[key] || 0).toLocaleString() : result.status === 'loading' ? <span className="sl-placeholder" style={{ width: 60, height: 30 }} aria-hidden="true" /> : "—"}</strong></section>)}</div>
    <RefreshNotice result={result} /><p className="audit-refresh-note">Totals match the applied filters. Refreshes every 15 seconds while visible.{result.updatedAt && " Last updated: " + auditTime(result.updatedAt)}</p>
    <section className="admin-card audit-records">
      <form className="audit-filters" onSubmit={apply}>
        <label className="audit-search">Search<input name="search" value={draft.search} onChange={update} maxLength={160} placeholder="Actor, event code, role, or resource ID" /></label>
        <label>Role<select name="role" value={draft.role} onChange={update}><option value="">All roles</option>{Object.entries(auditRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Event type<select name="action" value={draft.action} onChange={update}><option value="">All events</option>{Object.entries(auditEvents).map(([key, [label]]) => <option key={key} value={key}>{key === "AUTH_LOGIN" ? "Login attempt" : label}</option>)}</select></label>
        <label>Result<select name="outcome" value={draft.outcome} onChange={update}><option value="">All results</option><option value="success">Successful</option><option value="failure">Failed</option></select></label>
        <label>From (Philippine date)<input type="date" name="from" value={draft.from} onChange={update} /></label>
        <label>Through (Philippine date)<input type="date" name="to" value={draft.to} onChange={update} /></label>
        <label>Date order<select name="sort" value={draft.sort} onChange={update}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
        <div className="audit-filter-actions"><button type="submit">Apply filters</button><button type="button" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setFilterError(""); }}>Clear</button></div>
        {filterError && <p role="alert">{filterError}</p>}
      </form>
      <FeedState result={result} table />
      <div className="audit-table-scroll" tabIndex={0} role="region" aria-label="Audit records table">
        <table className="audit-table"><thead><tr>{["Date & time", "Actor", "Role", "Event", "Description", "Related resource", "Result", "Details"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{result.status === 'loading' && !result.data ? <SkeletonTableRows /> : rows.map((event) => {
          const view = auditPresentation(event);
          return <tr key={event._id}><td><time dateTime={event.createdAt}>{auditTime(event.createdAt)}</time></td><td>{view.actor}</td><td>{view.role}</td><td><strong>{view.title}</strong></td><td>{view.description}</td><td className="audit-resource">{view.resource}</td><td><ResultBadge value={event.outcome} /></td><td><button type="button" onClick={() => setSelected(event._id)} aria-label={"View details for " + view.title + " at " + auditTime(event.createdAt)}>View</button></td></tr>;
        })}</tbody></table>
      </div>
      {result.status === "success" && !rows.length && <p className="audit-empty">No events match these filters.</p>}
      <nav className="audit-pagination" aria-label="Audit log pagination"><span>{pagination ? pagination.total.toLocaleString() + " matching events · Page " + page + " of " + Math.max(1, pagination.totalPages) : "Loading page…"}</span><div><button disabled={page <= 1 || result.status === "loading"} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={!pagination || page >= pagination.totalPages || result.status === "loading"} onClick={() => setPage((value) => value + 1)}>Next</button></div></nav>
    </section>
    {selected && <AuditDetails id={selected} onClose={() => setSelected(null)} />}
  </div>;
}

