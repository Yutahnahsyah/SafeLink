import { useEffect, useRef, useState } from 'react';
import { personnelApi } from '../services/safelinkApi';

const personnelRoles = ['barangay_personnel', 'lgu_personnel', 'police_personnel'];

export default function AccountRecoveryAction({ account }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const dialog = useRef(null);
  const submitting = useRef(false);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    dialog.current.showModal();
    return () => trigger.current?.focus();
  }, [open]);
  if (!personnelRoles.includes(account.role)) return null;
  const close = () => { if (!submitting.current) setOpen(false); };
  const send = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await personnelApi.resetPersonnelPassword(account._id);
      setFeedback({ message: response.message || 'Password recovery instructions sent.', error: false });
    } catch (error) {
      setFeedback({ message: error.message || 'Could not send recovery instructions. Please try again.', error: true });
    } finally { submitting.current = false; setBusy(false); }
  };
  return <>
    <button type="button" ref={trigger} aria-label={`Reset password for ${account.firstName} ${account.lastName}`} onClick={() => { setFeedback(null); setOpen(true); }}>Reset password</button>
    {open && <dialog ref={dialog} className="av-modal av-account-recovery" aria-labelledby={`recovery-title-${account._id}`} onCancel={event => { event.preventDefault(); close(); }}>
      <h3 id={`recovery-title-${account._id}`}>Personnel password recovery</h3>
      <p>Send a 15-minute recovery link to <strong>{account.email}</strong>? Their current password remains valid until they complete the reset.</p>
      {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
      <div><button type="button" disabled={busy} onClick={close}>{feedback && !feedback.error ? 'Done' : 'Cancel'}</button>
        {(!feedback || feedback.error) && <button type="button" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send reset link'}</button>}
      </div>
    </dialog>}
  </>;
}
