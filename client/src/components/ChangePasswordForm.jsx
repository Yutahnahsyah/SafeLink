import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { authApi } from '../services/safelinkApi';
import { passwordRequirements } from './registration/registrationConfig';
import FieldRequirement from './FieldRequirement';
import './LguAccountManagement.css';

export default function ChangePasswordForm({ onSuccess, modal = false }) {
  const { user } = useAuth();
  const mfaEnabled = user?.mfaEnabled === true;
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', mfaCode: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    const issues = {};
    if (!values.currentPassword) issues.currentPassword = 'Enter your current password.';
    if (passwordRequirements.some((rule) => !rule.test(values.newPassword)) || new TextEncoder().encode(values.newPassword).length > 72) issues.newPassword = 'Use at least 8 characters (up to 72 bytes), an uppercase letter, a number, and a special character.';
    if (values.newPassword !== values.confirmPassword) issues.confirmPassword = 'Passwords do not match.';
    if (mfaEnabled && !/^\d{6}$/.test(values.mfaCode)) issues.mfaCode = 'Enter the current six-digit code from your authenticator app.';
    setErrors(issues); setMessage(''); setSuccess(false);
    if (Object.keys(issues).length) return;
    submitting.current = true; setBusy(true);
    try {
      const result = await authApi.changePassword(values);
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '', mfaCode: '' });
      setMessage(result.message); setSuccess(true); onSuccess?.();
    } catch (error) {
      setMessage(error.message);
      setErrors(Object.fromEntries((error.fieldErrors || []).map(({ field, message }) => [field, message])));
    } finally { submitting.current = false; setBusy(false); }
  };
  return <form className="lgu-password-form" onSubmit={submit} noValidate>
    {!modal && <h2>Change Password</h2>}<p>Use your current password to choose a new one.{mfaEnabled ? ' Because authenticator MFA is enabled, your current six-digit code is also required.' : ''}</p>
    {Object.entries({ currentPassword: 'Current Password', newPassword: 'New Password', confirmPassword: 'Confirm New Password' }).map(([key, label]) => <label key={key} htmlFor={`settings-${key}`}><span className="field-label-row">{label}<FieldRequirement /></span><input id={`settings-${key}`} type="password" required disabled={busy} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `settings-${key}-error` : undefined} />{errors[key] && <small id={`settings-${key}-error`} className="lgu-field-error">{errors[key]}</small>}</label>)}
    {mfaEnabled && <label htmlFor="settings-mfa-code"><span className="field-label-row">Authenticator code<FieldRequirement /></span><input id="settings-mfa-code" type="text" required disabled={busy} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={values.mfaCode} onChange={(e) => setValues({ ...values, mfaCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} aria-invalid={Boolean(errors.mfaCode)} aria-describedby={errors.mfaCode ? 'settings-mfa-code-error' : undefined} />{errors.mfaCode && <small id="settings-mfa-code-error" className="lgu-field-error">{errors.mfaCode}</small>}</label>}
    {message && <p role={success ? 'status' : 'alert'} className={success ? '' : 'lgu-field-error'}>{message}</p>}
    <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save New Password'}</button>
  </form>;
}

export function ChangePasswordModal({ open, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    return undefined;
  }, [open]);
  return <dialog className="password-change-dialog" ref={dialog} aria-labelledby="password-change-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }}>
    <header><h2 id="password-change-dialog-title">Change Password</h2><button type="button" aria-label="Close change password" onClick={onClose}>×</button></header>
    <ChangePasswordForm modal onSuccess={() => {}} />
  </dialog>;
}
