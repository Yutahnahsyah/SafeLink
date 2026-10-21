import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import { verifyCitizenEmail } from "../services/accountApi";
import { authApi } from "../services/safelinkApi";
import { dashboardForRole } from "../services/authPolicy";
import { useLoginCooldown } from '../services/useLoginCooldown';
import LoginCooldownNotice from './LoginCooldownNotice';
import FieldRequirement from './FieldRequirement';
import "./UnifiedAuth.css";
export { default as RegisterPage } from "./registration/RegisterPage";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRules = [
  ["length", "At least 8 characters", (value) => value.length >= 8],
  ["upper", "One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["number", "One number", (value) => /\d/.test(value)],
  ["special", "One special character", (value) => /[\W_]/.test(value)],
];

const portalConfig = Object.freeze({
  unified: { eyebrow: "SafeLink Account Access", heading: "One trusted connection. A safer community.", copy: "Stay connected to verified community reports and coordinated local assistance across Pangasinan.", notice: "Your account permissions are verified securely when you sign in." },
});

function AuthShell({ title, text, children, footer, portal = "unified", wide = false }) {
  const config = portalConfig[portal] || portalConfig.unified;
  return (
    <main className={`auth-page auth-page--${portal}`}>
      <section className="auth-aside">
        <Link to="/">
          <BrandLogo showName={false} />
        </Link>
        <div>
          <span>{config.eyebrow}</span>
          <h1>{config.heading}</h1>
          <p>{config.copy}</p>
        </div>
        <small>
          <Icon name="shield" /> {config.notice}
        </small>
      </section>
      <section className="auth-panel">
        <div className={`auth-card${wide ? " auth-card--wide" : ""}`}>
          <BrandLogo href="/" variant="auth" />
          <div className="auth-heading">
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
          {children}
          <p className="auth-switch">{footer}</p>
        </div>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
  type = "text",
  className = "",
  ...props
}) {
  const invalid = touched && error;
  return (
    <label
      className={`${className} ${invalid ? "has-error" : touched && !error ? "is-valid" : ""}`}
      htmlFor={id}
    >
      <span className="field-label-row">{label}<FieldRequirement /></span>
      <input
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={Boolean(invalid)}
        aria-describedby={invalid ? `${id}-error` : undefined}
        type={type}
        {...props}
      />
      {invalid && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className={`password-field ${touched && error ? "has-error" : touched && !error ? "is-valid" : ""}`}
    >
      <label htmlFor={id}><span className="field-label-row">{label}<FieldRequirement /></span></label>
      <div className="password-input">
        <input
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(touched && error)}
          aria-describedby={touched && error ? `${id}-error` : undefined}
          type={visible ? "text" : "password"}
          {...props}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(!visible)}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          <Icon name="eye" size={18} />
        </button>
      </div>
      {touched && error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Rules({ value }) {
  return (
    <ul className="password-rules" aria-label="Password requirements">
      {passwordRules.map(([key, text, test]) => (
        <li className={test(value) ? "is-valid" : ""} key={key}>
          <Icon name="check" size={14} />
          {text}
        </li>
      ))}
    </ul>
  );
}

function LoadingButton({ children, loading, loadingText, disabled = false }) {
  return (
    <button className="button" type="submit" disabled={loading || disabled}>
      {loading ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          {loadingText}
        </>
      ) : (
        <>
          {children}
          <Icon name="arrow" size={16} />
        </>
      )}
    </button>
  );
}

function passwordError(value) {
  const failedRule = passwordRules.find(([, text, test]) => !test(value));
  return failedRule ? `Password must contain ${failedRule[1].toLowerCase()}.` : "";
}

// Compatibility export: the old selector now renders the same unified form.
export function LoginSelectorPage() { return <LoginPage />; }

function MfaLoginStep({ challenge, onAuthenticated, onCancel }) {
  const enrollment = Boolean(challenge.mfaEnrollmentRequired);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [completedPayload, setCompletedPayload] = useState(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(enrollment);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enrollment) return undefined;
    let active = true;
    authApi.mfaSetup(challenge.mfaToken).then((payload) => {
      if (active) setSetup(payload);
    }).catch((requestError) => {
      if (active) setError(requestError?.message || "We couldn't create your authenticator setup.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [challenge.mfaToken, enrollment]);

  const submit = async (event) => {
    event.preventDefault();
    const value = useRecovery ? recoveryCode.trim() : code.trim();
    if (!value) { setError(useRecovery ? "Enter one of your recovery codes." : "Enter the six-digit code from your authenticator app."); return; }
    setLoading(true); setError("");
    try {
      const payload = enrollment
        ? await authApi.confirmMfaEnrollment(challenge.mfaToken, value)
        : useRecovery
          ? await authApi.recoverMfa(challenge.mfaToken, value, trustDevice)
          : await authApi.verifyMfa(challenge.mfaToken, value, trustDevice);
      if (Array.isArray(payload.recoveryCodes)) {
        setRecoveryCodes(payload.recoveryCodes);
        setCompletedPayload(payload);
      } else onAuthenticated(payload);
    } catch (requestError) {
      setError(requestError?.message || "We couldn't verify that code. Try again.");
    } finally { setLoading(false); }
  };

  if (recoveryCodes && completedPayload) return <AuthShell title="Save your recovery codes" text="Store these one-time codes somewhere safe. They are the only way to sign in if you lose your authenticator device." footer={<button className="forgot-link" type="button" onClick={() => onAuthenticated(completedPayload)}>I saved them — continue</button>}>
    <div className="form-success" role="status"><Icon name="shield" size={20} /><div><strong>Authenticator MFA is enabled.</strong><p>Each recovery code works once.</p></div></div>
    <ul className="mfa-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
  </AuthShell>;

  const title = enrollment ? "Set up your authenticator" : "Verify your sign-in";
  const text = enrollment ? "Scan this QR code using an authenticator app, then enter its current six-digit code." : "Enter the current six-digit code from your authenticator app to finish signing in.";
  return <AuthShell title={title} text={text} footer={<button className="forgot-link" type="button" onClick={onCancel}>Return to sign in</button>}>
    {loading && <p className="form-success" role="status">Preparing secure authenticator setup…</p>}
    {enrollment && setup && <div className="mfa-enrollment"><img src={setup.qrCodeDataUrl} width="256" height="256" alt="Scan this QR code in your authenticator app" /><label><span className="field-label-row">Manual setup key<FieldRequirement>Copy if needed</FieldRequirement></span><input value={setup.manualEntryKey} readOnly onFocus={(event) => event.target.select()} aria-label="Manual authenticator setup key" /></label><small>Use this key only if you cannot scan the QR code. Treat it like a password.</small></div>}
    {!loading && <form className="auth-form" onSubmit={submit} noValidate>
      {!enrollment && <button className="forgot-link" type="button" onClick={() => { setUseRecovery(!useRecovery); setError(""); }}>{useRecovery ? "Use authenticator code instead" : "Use a recovery code instead"}</button>}
      {useRecovery ? <Field id="mfa-recovery-code" label="Recovery code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="one-time-code" /> : <Field id="mfa-code" label="Authenticator code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />}
      {!enrollment && <label className="mfa-trust-device"><input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} /><span><strong>Trust this device for 15 days</strong><small>Only choose this on a private device you control.</small></span></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <LoadingButton loading={loading} loadingText="Verifying…">{enrollment ? "Enable authenticator MFA" : useRecovery ? "Use recovery code" : "Verify and sign in"}</LoadingButton>
    </form>}
  </AuthShell>;
}

export function LoginPage() {
  const { login, completeMfaLogin } = useAuth();
  const { navigate } = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const cooldown = useLoginCooldown(values.email);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendAvailable, setResendAvailable] = useState(false);
  const [resending, setResending] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const errors = {
    email: !values.email.trim() ? "Email is required." : !emailPattern.test(values.email.trim()) ? "Please enter a valid email address." : "",
    password: !values.password ? "Password is required." : "",
  };
  const update = (key) => (event) => { setValues({ ...values, [key]: event.target.value }); setError(""); setSuccess(""); setResendAvailable(false); };
  const submit = async (event) => {
    event.preventDefault();
    if (loading || cooldown.remainingSeconds > 0) return;
    setTouched({ email: true, password: true });
    if (Object.values(errors).some(Boolean)) { setError("Please correct the highlighted fields."); return; }
    setLoading(true);
    try {
      const account = await login(values);
      if (account?.mfaRequired || account?.mfaEnrollmentRequired) {
        cooldown.clear(values.email);
        setMfaChallenge(account);
        return;
      }
      cooldown.clear(values.email);
      navigate(dashboardForRole(account.role), { replace: true });
    } catch (requestError) {
      if (cooldown.start(values.email, requestError)) { setError(''); setResendAvailable(false); return; }
      setResendAvailable(requestError?.code === 'EMAIL_NOT_VERIFIED');
      const messages = {
        INVALID_CREDENTIALS: "We couldn't sign you in. Check your email and password and try again.",
        ACCOUNT_PENDING: "Your account is awaiting administrator approval.",
        EMAIL_NOT_VERIFIED: "Verify your email address before signing in.",
        ACCOUNT_SUSPENDED: "This account is inactive. Contact your account administrator.",
        ROLE_MISMATCH: "This account has no authorized SafeLink workspace. Contact your administrator.",
        NETWORK_ERROR: "We couldn't reach SafeLink. Check your connection and try again.",
        SERVER_ERROR: "SafeLink sign-in is temporarily unavailable. Please try again later.",
      };
      setError(requestError?.status === 429 ? requestError.message : messages[requestError?.code] || "We couldn't sign you in. Please try again.");
    } finally { setLoading(false); }
  };
  if (mfaChallenge) return <MfaLoginStep challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); setError(""); }} onAuthenticated={(payload) => {
    const account = completeMfaLogin(payload);
    navigate(dashboardForRole(account.role), { replace: true });
  }} />;
  return <AuthShell title="Welcome Back" text="Sign in to your SafeLink account." footer={<>New to SafeLink? <Link to="/register">Create Citizen Account</Link></>}>
    <div className="unified-auth-trust"><Icon name="shield" size={17} /> Secure account access</div>
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field id="login-email" label="Email Address" type="email" autoComplete="username" value={values.email} onChange={update('email')} onBlur={() => setTouched({ ...touched, email: true })} error={errors.email} touched={touched.email} required />
      <PasswordField id="login-password" label="Password" autoComplete="current-password" value={values.password} onChange={update('password')} onBlur={() => setTouched({ ...touched, password: true })} error={errors.password} touched={touched.password} required />
      <Link className="forgot-link" to="/forgot-password">Forgot Password?</Link>
      {cooldown.remainingSeconds > 0 ? <LoginCooldownNotice remainingSeconds={cooldown.remainingSeconds} /> : error && <p className="form-error" role="alert">{error}</p>}
      {resendAvailable && <button className="button button-muted" type="button" disabled={resending} onClick={async () => {
        setResending(true);
        try { await authApi.resendVerification(values.email.trim().toLowerCase()); setSuccess("If this Citizen account is unverified, verification instructions will be sent."); setResendAvailable(false); }
        catch (requestError) { setError(requestError?.code === 'RESEND_COOLDOWN' ? 'Please wait before requesting another verification email.' : "We couldn't send the verification email. Please try again shortly."); }
        finally { setResending(false); }
      }}>{resending ? 'Sending?' : 'Resend verification email'}</button>}
      {success && <p className="form-success" role="status">{success}</p>}
      <LoadingButton loading={loading} disabled={cooldown.remainingSeconds > 0} loadingText="Signing in?">Sign In</LoadingButton>
    </form>
  </AuthShell>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (requestError) {
      setError(requestError?.code === "NETWORK_ERROR" ? "We couldn't reach SafeLink. Check your connection and try again." : requestError?.code === "EMAIL_DELIVERY_FAILED" ? "SafeLink saved your reset request, but couldn't deliver the email. Check the mail configuration or try again shortly." : "We couldn't send reset instructions right now. Please try again later.");
      setSent(false);
    } finally { setLoading(false); }
  };
  return (
    <AuthShell
      title="Reset your password"
      text="Enter your registered email address and we’ll send instructions to reset your password."
      footer={
        <>
          Remembered your password? <Link to="/login">Back to login</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {sent ? (
          <div className="form-success" role="status">
            <Icon name="check" size={20} />
            <div>
              <strong>Check your inbox</strong>
              <span>
                If an account is associated with that address, you’ll receive
                reset instructions shortly.
              </span>
            </div>
          </div>
        ) : (
          <>
            <Field
              id="reset-email"
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              onBlur={() => setTouched(true)}
              autoComplete="email"
              error={error}
              touched={touched}
            />
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send reset instructions"} <Icon name="arrow" size={16} />
            </button>
          </>
        )}
      </form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const { search } = useRouter();
  const [state, setState] = useState({ status: "verifying", message: "Activating your SafeLink Citizen account…" });
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!search || search === "?") {
      setState({ status: "failed", message: "This verification link is incomplete." });
      return () => { active = false; };
    }
    verifyCitizenEmail(search).then(() => {
      if (active) setState({ status: "success", message: "Your SafeLink Citizen account is now verified and ready to use." });
    }).catch((error) => {
      if (!active) return;
      if (["VERIFICATION_TOKEN_EXPIRED", "LINK_EXPIRED"].includes(error?.code)) setState({ status: "expired", message: "This verification link was valid for 15 minutes. Request a new verification link to continue activating your account." });
      else if (error?.code === "ALREADY_VERIFIED") setState({ status: "already", message: "This SafeLink Citizen account is already verified and ready to use." });
      else if (error?.code === "API_NOT_CONFIGURED") setState({ status: "unavailable", message: "Email verification is not connected in this client environment yet." });
      else setState({ status: "failed", message: "This activation link is invalid. Request a new verification email or check that you opened the complete link." });
    });
    return () => { active = false; };
  }, [search]);
  const presentation = {
    verifying: ["track", "Activating account"],
    success: ["check", "Account activated successfully"],
    expired: ["history", "Verification link expired"],
    already: ["check", "Account already activated"],
    failed: ["priority", "Activation failed"],
    unavailable: ["shield", "Verification unavailable"],
  }[state.status];
  const canResend = ["expired", "failed"].includes(state.status);
  const resend = async (event) => {
    event.preventDefault();
    setResendMessage("");
    if (!emailPattern.test(email.trim())) { setResendMessage("Enter the email address used for your Citizen account."); return; }
    setResending(true);
    try {
      await authApi.resendVerification(email.trim().toLowerCase());
      setResendMessage("New verification email sent. The new link will expire in 15 minutes.");
    } catch (error) {
      setResendMessage(error?.code === "RESEND_COOLDOWN" ? "Please wait before requesting another verification email." : error?.code === "EMAIL_DELIVERY_FAILED" ? "SafeLink couldn't deliver the new verification email. Check the mail configuration or try again shortly." : "We couldn't request a new verification email right now.");
    } finally { setResending(false); }
  };
  return <AuthShell title={presentation[1]} text="SafeLink Citizen account activation" footer={<>Return to <Link to="/login">Sign In</Link></>}>
    <section className={`verification-state is-${state.status}`} aria-live="polite" aria-busy={state.status === "verifying"}>
      <span><Icon name={presentation[0]} size={27} /></span><h3>{presentation[1]}</h3><p>{state.message}</p>
      {canResend && <form className="auth-form" onSubmit={resend} noValidate>
        <Field id="activation-resend-email" label="Email address" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setResendMessage(""); }} autoComplete="email" />
        <button className="button" type="submit" disabled={resending}>{resending ? "Sending…" : "Resend Verification Email"}</button>
        {resendMessage && <p className={resendMessage.startsWith("New verification") ? "form-success" : "form-error"} role="status">{resendMessage}</p>}
      </form>}
      {state.status !== "verifying" && <Link className="button button-muted" to="/login">{state.status === "success" ? "Continue to Sign In" : "Back to Sign In"} <Icon name="arrow" size={15} /></Link>}
    </section>
  </AuthShell>;
}

export function ResetPasswordPage() {
  const { search } = useRouter();
  const token = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("token");
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const errors = {
    password: passwordError(values.password),
    confirm: !values.confirm ? "Confirm password is required." : values.password !== values.confirm ? "Passwords do not match." : "",
  };
  const submit = async (event) => {
    event.preventDefault();
    setTouched({ password: true, confirm: true });
    if (Object.values(errors).some(Boolean)) return setError("Please correct the highlighted fields.");
    if (!token) return setError("This password-reset link is incomplete.");
    setLoading(true);
    try {
      await authApi.resetPassword(token, values.password);
      setSuccess("Your password has been reset. You can now sign in with the new password.");
      setError("");
    } catch (requestError) {
      setError(requestError?.code === "LINK_EXPIRED" || requestError?.code === "VALIDATION_ERROR" ? "This password-reset link is invalid or expired." : requestError?.code === "NETWORK_ERROR" ? "We couldn't reach SafeLink. Check your connection and try again." : "We couldn't reset your password right now.");
    } finally { setLoading(false); }
  };
  return <AuthShell title="Choose a new password" text={search ? "Create a strong replacement password for your SafeLink account." : "Open the complete password-reset link sent to your email."} footer={<>Return to <Link to="/login">SafeLink Login</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <PasswordField id="reset-password" label="New password" value={values.password} onChange={(event) => { setValues({ ...values, password: event.target.value }); setError(""); }} onBlur={() => setTouched({ ...touched, password: true })} error={errors.password} touched={touched.password} autoComplete="new-password" />
      <Rules value={values.password} />
      <PasswordField id="reset-confirm" label="Confirm new password" value={values.confirm} onChange={(event) => { setValues({ ...values, confirm: event.target.value }); setError(""); }} onBlur={() => setTouched({ ...touched, confirm: true })} error={errors.confirm} touched={touched.confirm} autoComplete="new-password" />
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <button className="button" type="submit" disabled={loading || Boolean(success)}>{loading ? "Resetting..." : "Reset password"} <Icon name="arrow" size={15} /></button>
    </form>
  </AuthShell>;
}

