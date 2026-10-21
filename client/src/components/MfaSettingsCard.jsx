import { useState } from 'react';
import { useAuth } from '../auth';
import { authApi } from '../services/safelinkApi';
import Icon from './Icon';
import './MfaSettingsCard.css';

export default function MfaSettingsCard() {
  const { user, setMfaEnabled } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableMode, setDisableMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const enabled = user?.mfaEnabled === true;

  const beginSetup = async () => {
    setBusy(true); setMessage(''); setCode('');
    try { setSetup(await authApi.mfaSettingsSetup()); }
    catch (error) { setMessage(error?.message || 'Unable to create an authenticator setup.'); }
    finally { setBusy(false); }
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    if (code.length !== 6) { setMessage('Enter the current six-digit authenticator code.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await authApi.confirmMfaSettings(code);
      setMfaEnabled(true);
      setRecoveryCodes(result.recoveryCodes || []);
      setSetup(null);
      setCode('');
    } catch (error) { setMessage(error?.message || 'Unable to enable authenticator MFA.'); }
    finally { setBusy(false); }
  };

  const disable = async (event) => {
    event.preventDefault();
    if (code.length !== 6) { setMessage('Enter the current six-digit authenticator code.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await authApi.disableMfaSettings(code);
      setMfaEnabled(false); setDisableMode(false); setCode(''); setMessage(result.message);
    } catch (error) { setMessage(error?.message || 'Unable to disable authenticator MFA.'); }
    finally { setBusy(false); }
  };

  return <section className="citizen-card mfa-settings-card" aria-label="Authenticator MFA settings">
    <span className="mfa-settings-card__icon"><Icon name="shield" /></span>
    <div className="mfa-settings-card__content">
      <small>Account security</small>
      <h2>Authenticator MFA</h2>
      {recoveryCodes ? <>
        <p><strong>MFA is enabled.</strong> Save these one-time recovery codes now. They will not be shown again.</p>
        <ul className="mfa-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
        <button className="button button-muted" type="button" onClick={() => setRecoveryCodes(null)}>I saved my recovery codes</button>
      </> : setup ? <>
        <p>Scan this QR code in an authenticator app, then enter the current six-digit code to enable MFA.</p>
        <div className="mfa-enrollment">
          <img src={setup.qrCodeDataUrl} width="256" height="256" alt="Scan this QR code in your authenticator app" />
          <label>Manual setup key<input value={setup.manualEntryKey} readOnly onFocus={(event) => event.target.select()} /></label>
          <small>Treat this setup key like a password. The QR code expires after ten minutes.</small>
        </div>
        <form onSubmit={confirmSetup} className="mfa-settings-card__form" noValidate>
          <label>Authenticator code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} /></label>
          <div><button className="button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Enable MFA'}</button><button className="button button-muted" type="button" disabled={busy} onClick={() => { setSetup(null); setCode(''); setMessage(''); }}>Cancel</button></div>
        </form>
      </> : enabled ? <>
        <p><strong>Enabled.</strong> You will enter an authenticator code whenever you sign in. Recovery codes remain valid until used.</p>
        {disableMode ? <form onSubmit={disable} className="mfa-settings-card__form" noValidate>
          <label>Current authenticator code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} /></label>
          <div><button className="button danger-button" type="submit" disabled={busy}>{busy ? 'Disabling…' : 'Disable MFA'}</button><button className="button button-muted" type="button" disabled={busy} onClick={() => { setDisableMode(false); setCode(''); setMessage(''); }}>Cancel</button></div>
        </form> : <button className="button button-muted" type="button" onClick={() => { setDisableMode(true); setMessage(''); }}>Disable MFA</button>}
      </> : <>
        <p><strong>Optional.</strong> Add an authenticator app as a second sign-in step to better protect your SafeLink account.</p>
        <button className="button" type="button" onClick={beginSetup} disabled={busy}>{busy ? 'Preparing…' : 'Set up MFA'}</button>
      </>}
      {message && <p className="mfa-settings-card__message" role="alert">{message}</p>}
    </div>
  </section>;
}
