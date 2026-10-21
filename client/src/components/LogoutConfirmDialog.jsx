import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import "./LogoutConfirmDialog.css";

export default function LogoutConfirmDialog({ open, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const backgroundRoots = [...document.body.children].filter(
      (element) => !element.classList.contains("logout-confirm-backdrop"),
    );
    const previousStates = backgroundRoots.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }));

    document.body.style.overflow = "hidden";
    backgroundRoots.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    cancelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Tab") {
        const focusable = [...dialogRef.current?.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      previousStates.forEach(({ element, ariaHidden, inert }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(<div className="logout-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section ref={dialogRef} className="logout-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description">
      <span className="logout-confirm-icon"><Icon name="arrow" size={22} /></span>
      <div>
        <p className="logout-confirm-eyebrow">Current session</p>
        <h2 id="logout-confirm-title">Sign out of SafeLink?</h2>
        <p id="logout-confirm-description">You will need to sign in again to access your workspace.</p>
      </div>
      <div className="logout-confirm-actions">
        <button type="button" className="logout-confirm-cancel" ref={cancelRef} onClick={onCancel}>Stay signed in</button>
        <button type="button" className="logout-confirm-submit" ref={confirmRef} onClick={onConfirm}>Sign out</button>
      </div>
    </section>
  </div>, document.body);
}
