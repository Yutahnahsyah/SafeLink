import { useEffect, useRef, useState } from "react";
import { getLastActivity, markActivity } from "../services/apiClient";
import "./CitizenSessionReminder.css";

const WARNING_AFTER = 15 * 60 * 1000;
const LOGOUT_AFTER = WARNING_AFTER + 2 * 60 * 1000;

export default function CitizenSessionReminder({ userId, onTimeout }) {
  const [remaining, setRemaining] = useState(null);
  const dialog = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  const continueRef = useRef(null);
  const staySignedInRef = useRef(() => {});
  const activityRef = useRef(0);

  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    let lastActivity = getLastActivity();
    if (!lastActivity) { lastActivity = Date.now(); markActivity(); }
    let warningShown = false;
    let timedOut = false;

    const check = () => {
      if (timedOut) return;
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= LOGOUT_AFTER) {
        timedOut = true;
        onTimeoutRef.current();
      } else if (elapsed >= WARNING_AFTER) {
        warningShown = true;
        setRemaining(Math.ceil((LOGOUT_AFTER - elapsed) / 1000));
      }
    };
    const activity = () => {
      if (timedOut || warningShown) return;
      if (Date.now() - lastActivity >= WARNING_AFTER) { check(); return; }
      lastActivity = Date.now();
      if (lastActivity - activityRef.current >= 5000) {
        activityRef.current = lastActivity;
        markActivity();
      }
    };
    const staySignedIn = () => {
      if (Date.now() - lastActivity >= LOGOUT_AFTER) { check(); return; }
      lastActivity = Date.now();
      activityRef.current = lastActivity;
      markActivity();
      warningShown = false;
      setRemaining(null);
    };
    staySignedInRef.current = staySignedIn;

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 1000);
    check();
    return () => {
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);

  const warningOpen = remaining !== null;
  useEffect(() => {
    if (!warningOpen) return;
    if (!dialog.current.open) dialog.current.showModal();
    continueRef.current?.focus();
    return () => { if (dialog.current?.open) dialog.current.close(); };
  }, [warningOpen]);

  if (remaining === null) return null;
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return <dialog ref={dialog} className="citizen-session-dialog" role="alertdialog" aria-labelledby="citizen-session-title" aria-describedby="citizen-session-description" onCancel={(event) => event.preventDefault()}>
    <span className="citizen-session-eyebrow">SafeLink session reminder</span>
    <h2 id="citizen-session-title">Are you still there?</h2>
    <p id="citizen-session-description">You have been inactive for 15 minutes. For your account's safety, you will be signed out in <strong>{minutes}:{seconds}</strong> unless you continue.</p>
    <div className="citizen-session-actions">
      <button ref={continueRef} type="button" onClick={() => staySignedInRef.current()}>I'm still here</button>
    </div>
  </dialog>;
}
