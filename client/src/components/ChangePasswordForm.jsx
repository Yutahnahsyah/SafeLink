import { useRef, useState } from 'react';
import { authApi } from '../services/safelinkApi';
import { passwordRequirements } from './registration/registrationConfig';
import FieldRequirement from './FieldRequirement';
import './LguAccountManagement.css';

export default function ChangePasswordForm() {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
    setErrors(issues); setMessage(''); setSuccess(false);
    if (Object.keys(issues).length) return;
    submitting.current = true; setBusy(true);
    try {
      const result = await authApi.changePassword(values);
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage(result.message); setSuccess(true);
    } catch (error) {
      setMessage(error.message);
      setErrors(Object.fromEntries((error.fieldErrors || []).map(({ field, message }) => [field, message])));
    } finally { submitting.current = false; setBusy(false); }
  };
  return <form className="lgu-password-form" onSubmit={submit} noValidate>
    <h2>Change Password</h2><p>Changing your password is optional. You can continue using your initial credentials until you choose to update them.</p>
    {Object.entries({ currentPassword: 'Current Password', newPassword: 'New Password', confirmPassword: 'Confirm New Password' }).map(([key, label]) => <label key={key} htmlFor={`settings-${key}`}><span className="field-label-row">{label}<FieldRequirement /></span><input id={`settings-${key}`} type="password" required disabled={busy} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `settings-${key}-error` : undefined} />{errors[key] && <small id={`settings-${key}-error`} className="lgu-field-error">{errors[key]}</small>}</label>)}
    {message && <p role={success ? 'status' : 'alert'} className={success ? '' : 'lgu-field-error'}>{message}</p>}
    <button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save New Password'}</button>
  </form>;
}
