import { useCallback, useState } from "react";
import AdminShell from "./AdminShell";
import Icon from "./Icon";
import { Link } from "../routing";
import { useAuth } from "../auth";
import { adminOverviewApi } from "../services/safelinkApi";
import { useApiResource } from "../services/useApiResource";
import "./CommunityMapPublication.css";
import { SectionSkeleton, RefreshNotice } from './PageSkeletons';

const reasons = {
  sensitive_category: "Sensitive incident category",
  invalid_location: "Location cannot be safely generalized",
  missing_resolution_date: "Resolution date unavailable",
  manual_hide: "Hidden by an administrator",
  unresolved: "Incident reopened"
};

export default function CommunityMapPublicationPage() {
  const { user, isAdminPreviewMode } = useAuth();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => adminOverviewApi.communityMapQueue(page), [page]);
  const result = useApiResource(loader, [user?.id, page], { enabled: Boolean(user?.id) && !isAdminPreviewMode, initialData: { items: [] } });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const decide = async (item, approved) => {
    setBusy(item.id); setError(""); setMessage("");
    try {
      await adminOverviewApi.setCommunityMapApproval(item.id, approved);
      setMessage(approved ? "Publication restored after the backend safety check." : "Report hidden from the community map.");
      result.retry();
    } catch (failure) { setError(failure?.message || "Could not save the publication decision."); }
    finally { setBusy(""); }
  };
  const formatDate = (date) => date ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(date)) : "—";
  return <AdminShell title="Community Map Publication" eyebrow="Incident analytics">
    <div className="community-publication">
      <Link className="community-publication-back" to="/admin/incident-analytics"><Icon name="arrow" size={16} /> Back to Incident Analytics</Link>
      <p className="community-publication-note">Safely resolved incidents publish automatically. Sensitive or unsafe reports remain hidden. Administrators can revoke publication at any time; the backend checks every attempt to restore it.</p>
      {error && <p className="community-publication-message is-error" role="alert">{error}</p>}
      {message && <p className="community-publication-message" role="status">{message}</p>}
      <RefreshNotice result={result} />
      {isAdminPreviewMode ? <p className="community-publication-message">Publication decisions require a signed-in administrator.</p>
        : result.status === "loading" ? <SectionSkeleton variant="list" rows={5} label="Loading publication statuses" />
          : result.status === "error" ? <p className="community-publication-message" role="alert">Could not load publication statuses. <button type="button" onClick={result.retry}>Retry</button></p>
            : !(result.data?.items || []).length ? <p className="community-publication-message">No reports are available for publication review.</p>
              : <div className="community-publication-list">{result.data.items.map((item) => {
                const published = item.publicationStatus === "published" && Boolean(item.approvedAt);
                return <article key={item.id}>
                  <span className="community-publication-icon"><Icon name="report" size={20} /></span>
                  <div><strong>{item.category}</strong><p>{[item.barangay, item.municipality].filter(Boolean).join(", ") || "Location unavailable"} · {item.status}</p><small>Reported {formatDate(item.createdAt)}{item.resolvedAt ? ` · Resolved ${formatDate(item.resolvedAt)}` : ""} · Report {item.id.slice(-8)}</small>{item.publicationReason && <small className="community-publication-reason">{reasons[item.publicationReason] || "Held for review"}</small>}</div>
                  <span className={`community-publication-status${published ? " is-approved" : ""}`}>{published ? "Published" : item.publicationStatus === "hidden" ? "Hidden" : item.publicationStatus === "held" ? "Held for review" : "Pending"}</span>
                  {published ? <button type="button" disabled={busy === item.id} onClick={() => decide(item, false)}>{busy === item.id ? "Saving…" : "Hide from map"}</button>
                    : item.publicationStatus === "hidden" ? <button type="button" disabled={busy === item.id} onClick={() => decide(item, true)}>{busy === item.id ? "Saving…" : "Restore if safe"}</button> : null}
                </article>;
              })}<div className="community-publication-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {result.data.pagination?.totalPages || 1}</span><button type="button" disabled={page >= (result.data.pagination?.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
      <p className="community-publication-note">Category and location safety rules are enforced by the backend. The citizen response never includes reporter details, evidence, descriptions, or source coordinates.</p>
    </div>
  </AdminShell>;
}
