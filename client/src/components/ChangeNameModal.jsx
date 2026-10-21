import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import FieldRequirement from './FieldRequirement';
import './LguAccountManagement.css';

export default function ChangeNameModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const dialog = useRef(null);
  const [values, setValues] = useState({ firstName: '', middleInitial: '', lastName: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ firstName: user?.firstName || '', middleInitial: user?.middleInitial || '', lastName: user?.lastName || '' });
      setErrors({});
    }
  }, [open, user?.firstName, user?.middleInitial, user?.lastName]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    return undefined;
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const next = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    const nextErrors = {};
    if (!next.firstName) nextErrors.firstName = 'Enter your first name.';
    if (!next.lastName) nextErrors.lastName = 'Enter your last name.';
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    setBusy(true); setErrors({});
    try {
      await updateUser(next);
      onClose();
    } catch (error) {
      setErrors(Object.fromEntries((error.fieldErrors || []).map(({ field, message }) => [field, message])));
      if (!error.fieldErrors?.length) setErrors({ form: error.message || 'Could not update your name.' });
    } finally { setBusy(false); }
  };

  return <dialog className="password-change-dialog" ref={dialog} aria-labelledby="change-name-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }}>
    <header><h2 id="change-name-dialog-title">Change Name</h2><button type="button" aria-label="Close change name" onClick={onClose}>×</button></header>
    <form className="lgu-password-form" onSubmit={submit} noValidate>
      <p>Update the name shown in SafeLink. Your existing reports will show this updated name where your account is authorized to be identified.</p>
      <label htmlFor="change-name-first"><span className="field-label-row">First Name<FieldRequirement /></span><input id="change-name-first" type="text" autoComplete="given-name" maxLength={80} required disabled={busy} value={values.firstName} onChange={(event) => setValues({ ...values, firstName: event.target.value })} aria-invalid={Boolean(errors.firstName)} />{errors.firstName && <small className="lgu-field-error">{errors.firstName}</small>}</label>
      <label htmlFor="change-name-middle"><span className="field-label-row">Middle Initial</span><input id="change-name-middle" type="text" autoComplete="additional-name" maxLength={1} disabled={busy} value={values.middleInitial} onChange={(event) => setValues({ ...values, middleInitial: event.target.value.toUpperCase() })} aria-invalid={Boolean(errors.middleInitial)} />{errors.middleInitial && <small className="lgu-field-error">{errors.middleInitial}</small>}</label>
      <label htmlFor="change-name-last"><span className="field-label-row">Last Name<FieldRequirement /></span><input id="change-name-last" type="text" autoComplete="family-name" maxLength={80} required disabled={busy} value={values.lastName} onChange={(event) => setValues({ ...values, lastName: event.target.value })} aria-invalid={Boolean(errors.lastName)} />{errors.lastName && <small className="lgu-field-error">{errors.lastName}</small>}</label>
      {errors.form && <p role="alert" className="lgu-field-error">{errors.form}</p>}
      <div className="settings-card-actions"><button className="button button-muted" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Name'}</button></div>
    </form>
  </dialog>;
}
