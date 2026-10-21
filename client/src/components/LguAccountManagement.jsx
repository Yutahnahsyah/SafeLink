import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { Link } from '../routing';
import { personnelApi } from '../services/safelinkApi';
import { useApiResource } from '../services/useApiResource';
import { SectionSkeleton, RefreshNotice } from './PageSkeletons';
import { pangasinanLocations } from '../data/pangasinanLocations';
import Icon from './Icon';
import { useRegistrationLocations } from '../services/useRegistrationLocations';
import FieldRequirement from './FieldRequirement';
const roleLabels = { barangay_personnel: 'Barangay Personnel', lgu_personnel: 'LGU Personnel', police_personnel: 'Police Personnel' };
import './LguAccountManagement.css';

const blank = { firstName: '', middleInitial: '', lastName: '', email: '', phoneNumber: '', municipalityOrCity: '', status: 'active', role: 'lgu_personnel', barangay: '' };
const DialogDismissContext = createContext(null);
function DismissButton({ children, ...props }) {
  const dismiss = useContext(DialogDismissContext);
  return <button {...props} type="button" onClick={dismiss}>{children}</button>;
}
const name = (u) => [u.firstName, u.middleInitial && `${u.middleInitial}.`, u.lastName].filter(Boolean).join(' ');
const date = (value) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not recorded';
function validate(values, barangays) {
  const errors = {};
  for (const key of ['firstName', 'lastName']) if (!values[key].trim() || values[key].trim().length > 80) errors[key] = 'Enter a name of up to 80 characters.';
  if (!/^[A-Z]?$/.test(values.middleInitial)) errors.middleInitial = 'Use one uppercase middle initial.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254) errors.email = 'Enter a valid official email address.';
  if (!/^(09|\+639)\d{9}$/.test(values.phoneNumber)) errors.phoneNumber = 'Use 09XXXXXXXXX or +639XXXXXXXXX.';
  if (!pangasinanLocations.some((item) => item.name === values.municipalityOrCity)) errors.municipalityOrCity = 'Select a city or municipality from the list.';
  if (!Object.hasOwn(roleLabels, values.role)) errors.role = 'Choose a supported personnel role.';
  if (values.role === 'barangay_personnel' && !barangays.some((item) => item.name === values.barangay)) errors.barangay = 'Select a barangay belonging to the assigned municipality.';
  return errors;
}
function Dialog({ title, close, children, busy = false }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [closing, setClosing] = useState(false);
  const dismiss = () => {
    if (busy || closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { close(); return; }
    setClosing(true);
    timer.current = window.setTimeout(close, 220);
  };
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { window.clearTimeout(timer.current); previous?.focus?.(); };
  }, []);
  return <dialog className={`lgu-account-dialog${closing ? ' is-closing' : ''}`} ref={ref} aria-labelledby="lgu-dialog-title" onCancel={(e) => { e.preventDefault(); dismiss(); }}>
    <header><span><Icon name="shield" /> SafeLink personnel</span><button type="button" aria-label="Close dialog" disabled={busy || closing} onClick={dismiss}>×</button></header>
    <h2 id="lgu-dialog-title">{title}</h2><DialogDismissContext.Provider value={dismiss}>{children}</DialogDismissContext.Provider>
  </dialog>;
}
function AccountForm({ person, close, saved }) {
  const [values, setValues] = useState(person ? { ...blank, ...Object.fromEntries(Object.keys(blank).map((key) => [key, person[key] || blank[key]])), municipalityOrCity: person.jurisdiction?.municipalityOrCity || '', barangay: person.jurisdiction?.barangay || '' } : { ...blank });
  const barangays = useRegistrationLocations('barangays', values.municipalityOrCity, '', values.role === 'barangay_personnel');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const clear = () => { setResult(null); close(); };
    window.addEventListener('pagehide', clear);
    window.addEventListener('safelink:session-expired', clear);
    return () => { window.removeEventListener('pagehide', clear); window.removeEventListener('safelink:session-expired', clear); };
  }, []);
  const dismiss = () => { setResult(null); close(); };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const issues = validate(values, barangays.data);
    setErrors(issues);
    if (Object.keys(issues).length) { document.getElementById(`lgu-${Object.keys(issues)[0]}`)?.focus(); return; }
    if (person && !confirmEdit) { setConfirmEdit(true); return; }
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const payload = { ...values, firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim().toLowerCase() };
      if (person) { delete payload.email; delete payload.role; delete payload.status; }
      const response = person ? await personnelApi.updatePersonnel(person._id, payload) : await personnelApi.createPersonnel(payload);
      if (!mounted.current) return;
      saved();
      if (person) dismiss(); else setResult(response);
    } catch (error) {
      if (!mounted.current) return;
      setErrors(Object.fromEntries((error.fieldErrors || []).map((item) => [item.field, item.message])));
      setMessage(error.message + (error.code === 'NETWORK_ERROR' ? ' Check the directory before retrying. If the account exists, use password reset; its initial password cannot be retrieved.' : ''));
      setConfirmEdit(false);
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const field = (key, label, options = {}) => <label key={key} htmlFor={`lgu-${key}`}><span className="field-label-row">{label}<FieldRequirement optional={!options.required} /></span><input id={`lgu-${key}`} value={values[key]} onChange={(e) => { setValues({ ...values, [key]: e.target.value, ...(key === 'municipalityOrCity' && values.municipalityOrCity !== e.target.value ? { barangay: '' } : {}) }); setConfirmEdit(false); }} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `lgu-${key}-error` : undefined} {...options} />{errors[key] && <small className="lgu-field-error" id={`lgu-${key}-error`}>{errors[key]}</small>}</label>;
  return <Dialog close={dismiss} busy={busy} title={result ? 'Personnel Account Created Successfully' : person ? 'Edit Personnel Account' : 'Create Personnel Account'}>
    {result ? <div className="lgu-creation-result">
      <p className="lgu-account-notice"><Icon name="check" /> Provide these credentials privately to the intended official. This password is shown only now and cannot be retrieved after closing.</p>
      <dl><dt>Official</dt><dd>{name(result.user)}</dd><dt>Assigned jurisdiction</dt><dd>{[result.user.jurisdiction.barangay, result.user.jurisdiction.municipalityOrCity].filter(Boolean).join(", ")}</dd><dt>Assigned role</dt><dd>{roleLabels[result.user.role]}</dd><dt>Account status</dt><dd>{result.user.status}</dd><dt>Username / official email</dt><dd>{result.initialCredentials.username}</dd><dt>Initial password</dt><dd className="lgu-initial-password"><code>{result.initialCredentials.password}</code></dd></dl>
      <p>The official can use the provided initial credentials to sign in. Changing the password is optional and available in Account Settings.</p>
      <p>If these credentials are lost, initiate a password reset from Account Management.</p>
      <DismissButton className="button">Finish handoff and clear credentials</DismissButton>
    </div> : <form onSubmit={submit} noValidate>
      <p>{person ? 'Update official identity and jurisdiction. Account access is managed in Accounts.' : 'Create an authorized personnel account and assign its jurisdiction. New accounts start active.'}</p>
      <fieldset disabled={busy}><legend>Official identity</legend><div className="lgu-account-grid">
        {field('firstName', "Official's First Name", { maxLength: 80, autoComplete: 'given-name', required: true })}
        {field('lastName', "Official's Last Name", { maxLength: 80, autoComplete: 'family-name', required: true })}
        {field('middleInitial', 'Middle Initial', { maxLength: 1 })}
        {field('phoneNumber', 'Official contact number', { type: 'tel', required: true, autoComplete: 'tel' })}
        {field('email', 'Official Email Address', { type: 'email', maxLength: 254, required: true, readOnly: Boolean(person), autoComplete: 'off' })}
        <label htmlFor="lgu-role"><span className="field-label-row">Assigned Role<FieldRequirement /></span><select id="lgu-role" value={values.role} required disabled={Boolean(person)} onChange={(e) => { setValues({ ...values, role: e.target.value, barangay: '' }); setConfirmEdit(false); }}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select>{errors.role && <small className="lgu-field-error">{errors.role}</small>}</label>
      </div></fieldset>
      <fieldset disabled={busy}><legend>Assigned jurisdiction</legend><div className="lgu-account-grid">
        {field('municipalityOrCity', 'Assigned City or Municipality', { list: 'lgu-municipalities', required: true, autoComplete: 'off' })}
        <datalist id="lgu-municipalities">{pangasinanLocations.map((item) => <option key={item.name} value={item.name} />)}</datalist>{values.role === 'barangay_personnel' && <label htmlFor="lgu-barangay"><span className="field-label-row">Assigned Barangay<FieldRequirement /></span><select id="lgu-barangay" value={values.barangay} required disabled={barangays.status !== 'success'} onChange={(e) => { setValues({ ...values, barangay: e.target.value }); setConfirmEdit(false); }}><option value="">{barangays.status === 'loading' ? 'Loading barangays?' : 'Select a barangay'}</option>{barangays.data.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}</select>{errors.barangay && <small className="lgu-field-error">{errors.barangay}</small>}{barangays.status === 'error' && <button type="button" onClick={barangays.retry}>Retry barangays</button>}</label>}
      </div></fieldset>
      <p className="lgu-account-notice">{person ? 'Confirm changes to official identity or jurisdiction before saving. Account status and passwords remain unchanged.' : 'SafeLink generates a unique password. You will receive a one-time display for a private handoff. Password changes are optional.'}</p>
      {message && <p role="alert" className="lgu-field-error">{message}</p>}
      {confirmEdit && <p role="alert">Save these changes for {name(person)}? Updated jurisdiction applies to their next request.</p>}
      <footer><DismissButton disabled={busy}>Cancel</DismissButton><button className="button" disabled={busy} type="submit">{busy ? 'Saving…' : person ? confirmEdit ? 'Confirm and Save Changes' : 'Review Changes' : 'Create Account'}</button></footer>
    </form>}
  </Dialog>;
}
export default function LguAccountManagement({ onSaved, openCreateInitially = false }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: '', municipality: '', status: '', sort: 'newest', role: '', page: 1 });
  const [form, setForm] = useState(() => openCreateInitially ? {} : null);
  const result = useApiResource(() => personnelApi.directory(filters), [user?.id, filters.search, filters.municipality, filters.status, filters.sort, filters.role, filters.page], { enabled: Boolean(user?.id && !user.isDevelopmentPreview && user.role === 'admin') });
  const filter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });
  return <section className="av-panel lgu-account-management">
    <header className="lgu-directory-header"><div><span>Official appointments</span><h2>Personnel Directory</h2><p>Barangay, LGU, and Police officials, their assigned roles, and jurisdictions.</p></div><button className="button" onClick={() => setForm({})} disabled={!user?.id || user.isDevelopmentPreview}><Icon name="users" size={18} /> Create Personnel Account</button></header>
    <p className="lgu-directory-scope">Manage official details here. For verification, suspension, reactivation, or password recovery, <Link to="/admin/users">open Account Management</Link>.</p>
    <div className="lgu-directory-filters">
      <label>Search<input type="search" maxLength={80} placeholder="Official name or email" value={filters.search} onChange={filter('search')} /></label>
      <label>Municipality<select value={filters.municipality} onChange={filter('municipality')}><option value="">All municipalities</option>{pangasinanLocations.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      <label>Role<select value={filters.role} onChange={filter('role')}><option value="">All personnel roles</option>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label><label>Status<select value={filters.status} onChange={filter('status')}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
      <label>Created<select value={filters.sort} onChange={filter('sort')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    <RefreshNotice result={result} />{result.status === 'loading' ? <SectionSkeleton variant="table" rows={5} columns={7} label="Loading personnel accounts" /> : result.status === 'error' ? <p role="alert">{result.error.message} <button onClick={result.retry}>Retry</button></p> : result.status === 'idle' ? <p>Sign in with an administrator account to manage personnel.</p> : <>
      <div className="av-table-scroll"><table><thead><tr><th>Official</th><th>Jurisdiction</th><th>Role</th><th>Status</th><th>Created</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{(result.data?.data || []).map((person) => <tr key={person._id}><td><strong>{name(person)}</strong><small>{person.email}</small></td><td>{[person.jurisdiction?.barangay, person.jurisdiction?.municipalityOrCity].filter(Boolean).join(', ') || 'Unassigned'}</td><td>{roleLabels[person.role]}</td><td><span className={`av-badge ${person.status === 'active' ? 'is-active' : ''}`}>{person.status}</span></td><td>{date(person.createdAt)}</td><td>{date(person.lastLoginAt)}</td><td><div className="lgu-account-actions"><button onClick={() => setForm(person)}>Edit official details</button></div></td></tr>)}</tbody></table></div>
      {!result.data?.data?.length && <p>No personnel match these filters.</p>}
      <footer className="lgu-directory-pagination"><button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button><span>Page {filters.page} · {result.data?.pagination?.total || 0} accounts</span><button disabled={filters.page >= (result.data?.pagination?.totalPages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button></footer>
    </>}
    {form && <AccountForm person={form._id ? form : null} close={() => setForm(null)} saved={() => { result.retry(); onSaved?.(); }} />}
  </section>;
}
