import { useEffect, useState } from "react";
import { incidentApi } from "../services/safelinkApi";

export default function ProtectedEvidence({ incidentId, item, className = "" }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let url = "";
    setObjectUrl("");
    setError("");

    if (!incidentId || !item?.id) {
      setError("Evidence reference unavailable.");
      return undefined;
    }

    incidentApi.downloadEvidence(incidentId, item.id)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || "Unable to load this evidence.");
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [incidentId, item?.id]);

  if (error) return <span className={`evidence-load-state ${className}`.trim()} role="alert">{error}</span>;
  if (!objectUrl) return <span className={`evidence-load-state ${className}`.trim()} role="status">Loading evidence…</span>;

  if (item.type?.startsWith("video/")) {
    return <video className={className} src={objectUrl} controls preload="metadata" />;
  }

  return (
    <a className={className} href={objectUrl} download={item.name || "incident-evidence"}>
      <img src={objectUrl} alt={item.alt || item.name || "Incident evidence"} />
    </a>
  );
}
