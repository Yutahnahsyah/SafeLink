import { useEffect, useRef } from "react";
import Icon from "./Icon";
import "./LogoutConfirmDialog.css";

export default function LogoutConfirmDialog({ open, onCancel, onConfirm }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  return <div className="logout-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="logout-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description">
      <span className="logout-confirm-icon"><Icon name="arrow" size={22} /></span>
      <div>
        <p className="logout-confirm-eyebrow">Current session</p>
        <h2 id="logout-confirm-title">Sign out of SafeLink?</h2>
        <p id="logout-confirm-description">You will need to sign in again to access your workspace.</p>
      </div>
      <div className="logout-confirm-actions">
        <button type="button" className="logout-confirm-cancel" onClick={onCancel}>Stay signed in</button>
        <button type="button" className="logout-confirm-submit" ref={confirmRef} onClick={onConfirm}>Sign out</button>
      </div>
    </section>
  </div>;
}
