import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { Link, useRouter } from "../routing";
import { useAuth } from "../auth";
import { accountApiCapabilities, verifyCitizenEmail } from "../services/accountApi";
import { authApi } from "../services/safelinkApi";
export { default as RegisterPage } from "./registration/RegisterPage";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(09|\+639)\d{9}$/;
const passwordRules = [
  ["length", "At least 8 characters", (value) => value.length >= 8],
  ["upper", "One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["number", "One number", (value) => /\d/.test(value)],
  ["special", "One special character", (value) => /[\W_]/.test(value)],
];

const portalConfig = Object.freeze({
  citizen: { title: "Citizen Sign In", eyebrow: "SafeLink Citizen Access", heading: "Community safety starts with trusted information.", copy: "Submit structured reports, follow verified updates, and stay connected with local response activity.", notice: "Your reports and account information are protected.", button: "Sign In", destination: "/citizen/dashboard" },
  barangay: { title: "Barangay Personnel Sign In", eyebrow: "Local Community Response", heading: "Support verified response where community action begins.", copy: "Access authorized barangay response information and coordinate local follow-up through SafeLink.", notice: "Barangay personnel accounts are created and authorized by SafeLink administrators.", button: "Sign In", destination: "/barangay/dashboard" },
  lgu: { title: "LGU Personnel Sign In", eyebrow: "Local Government Response", heading: "Coordinate local response with trusted incident information.", copy: "Receive administrator-assigned incidents, coordinate response activity, and document resolution.", notice: "LGU accounts are created and approved by an authorized administrator.", button: "Sign In", destination: "/lgu/dashboard" },
  police: { title: "Police Personnel Sign In", eyebrow: "Authorized Response Access", heading: "Structured access for trusted incident-response partners.", copy: "Review authorized response information and coordinate through the shared SafeLink safety network.", notice: "Police partner accounts are managed by SafeLink administrators.", button: "Sign In", destination: "/police/dashboard" },
  admin: { title: "Administrator Sign In", eyebrow: "Provincial Command Access", heading: "Review, route, and oversee safety operations across Pangasinan.", copy: "Review citizen reports, coordinate LGU assignments, approve personnel, and monitor the response lifecycle.", notice: "Authorized administrator access only.", button: "Sign In", destination: "/admin/dashboard" },
});

function AuthShell({ title, text, children, footer, portal = "citizen", wide = false }) {
  const config = portalConfig[portal] || portalConfig.citizen;
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
      {label}
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
      <label htmlFor={id}>{label}</label>
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

function LoadingButton({ children, loading, loadingText }) {
  return (
    <button className="button" type="submit" disabled={loading}>
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

export function LoginSelectorPage() {
  const personnel = [
    ["barangay", "users", "Barangay Personnel", "Community-level response access"],
    ["lgu", "map", "LGU Personnel", "Municipal and city operations"],
    ["police", "shield", "Police Personnel", "Authorized partner response"],
    ["admin", "layers", "Administrator", "Provincial coordination access"],
  ];
  return <main className="login-selector-page">
    <section className="login-selector-intro">
      <BrandLogo href="/" variant="auth" />
      <div><span>One safety network, role-specific access</span><h1>Sign in to SafeLink</h1><p>Choose the workspace that matches your authorized account.</p></div>
      <small><Icon name="shield" size={15} /> Personnel access is issued and approved by SafeLink administrators.</small>
    </section>
    <section className="login-selector-options">
      <div className="login-selector-heading"><span>Citizen access</span><h2>Report and follow community concerns</h2><p>Public registration is available for Citizen accounts.</p></div>
      <Link className="citizen-access-card" to="/login/citizen"><span><Icon name="report" size={23} /></span><div><small>Public portal</small><strong>Citizen</strong><p>Submit incidents, track progress, and receive verified updates.</p></div><b>Sign in <Icon name="arrow" size={15} /></b></Link>
      <div className="login-selector-heading personnel-heading"><span>Authorized personnel</span><h2>Operational and administrative workspaces</h2><p>Personnel may apply for access and remain pending until approved.</p></div>
      <div className="personnel-access-grid">{personnel.map(([portal, icon, title, copy]) => <Link className={`personnel-access-card is-${portal}`} to={`/login/${portal}`} key={portal}><span><Icon name={icon} size={19} /></span><div><strong>{title}</strong><small>{copy}</small></div><Icon name="arrow" size={14} /></Link>)}</div>
      <p className="login-selector-foot"><Link to="/">Return to SafeLink</Link><span>Citizen without an account? <Link to="/register">Create one</Link></span></p>
    </section>
  </main>;
}

export function LoginPage({ portal = "citizen" }) {
  const config = portalConfig[portal] || portalConfig.citizen;
  const isCitizen = portal === "citizen";
  const { login } = useAuth();
  const { navigate } = useRouter();
  const [values, setValues] = useState({
    email: "",
    password: "",
  });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [resendAvailable, setResendAvailable] = useState(false);
  const [resending, setResending] = useState(false);
  const errors = {
    email: !values.email
      ? "Email is required."
      : !emailPattern.test(values.email)
        ? "Please enter a valid email address."
        : "",
    password: !values.password ? "Password is required." : "",
  };
  const update = (key) => (event) => {
    setValues({ ...values, [key]: event.target.value });
    setError("");
    setSuccess("");
    setResendAvailable(false);
  };
  const submit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.values(errors).some(Boolean)) {
      setError("Please correct the highlighted fields.");
      return;
    }
    setLoading(true);
    try {
      await login(portal, values);
      setLoading(false);
      setSuccess("Signed in. Opening your authorized workspace…");
      navigate(config.destination, { replace: true });
    } catch (requestError) {
      setLoading(false);
      setResendAvailable(isCitizen && requestError?.code === "EMAIL_NOT_VERIFIED");
      const messages = {
        API_NOT_CONFIGURED: "Sign-in is not connected in this client environment yet.",
        INVALID_CREDENTIALS: "We couldn't sign you in. Check your email and password and try again.",
        ACCOUNT_PENDING: "Your account is awaiting administrator approval.",
        EMAIL_NOT_VERIFIED: "Verify your email address before signing in.",
        ACCOUNT_SUSPENDED: "This account is suspended. Contact your account administrator.",
        ROLE_MISMATCH: `This account is not authorized for the ${config.title.replace(" Sign In", "")} portal.`,
        NETWORK_ERROR: "We couldn't reach SafeLink. Check your connection and try again.",
        SERVER_ERROR: "SafeLink sign-in is temporarily unavailable. Please try again later.",
      };
      setError(messages[requestError?.code] || "We couldn't sign you in. Please try again.");
    }
  };
  return (
    <AuthShell
      portal={portal}
      title={config.title}
      text={portal === "citizen" ? "Sign in to report incidents and privately track your submissions." : config.notice}
      footer={
        isCitizen
          ? <><span>New to SafeLink? <Link to="/register">Create an account</Link></span><span><Link to="/login">Choose another role</Link></span></>
          : <>Need a different workspace? <Link to="/login">Choose another role</Link></>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field
          id={`${portal}-login-email`}
          label="Email address"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          onBlur={() => setTouched({ ...touched, email: true })}
          error={errors.email}
          touched={touched.email}
        />
        <PasswordField
          id={`${portal}-login-password`}
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={update("password")}
          onBlur={() => setTouched({ ...touched, password: true })}
          error={errors.password}
          touched={touched.password}
        />
        <Link className="forgot-link" to="/forgot-password">
          Forgot your password?
        </Link>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {resendAvailable && <button className="button button-muted" type="button" disabled={resending} onClick={async () => {
          setResending(true);
          try { await authApi.resendVerification(values.email.trim().toLowerCase()); setSuccess("If this account is unverified, a new verification email is on its way."); setResendAvailable(false); }
          catch (requestError) { setError(requestError?.code === "RESEND_COOLDOWN" ? "Please wait before requesting another verification email." : "We couldn't send the verification email. Check the mail configuration and try again."); }
          finally { setResending(false); }
        }}>{resending ? "Sending…" : "Resend verification email"}</button>}
        {success && <p className="form-success" role="status">{success}</p>}
        <LoadingButton loading={loading} loadingText="Logging in...">
          {config.button}
        </LoadingButton>
        {!accountApiCapabilities[`login${portal === "lgu" ? "Lgu" : portal[0].toUpperCase() + portal.slice(1)}`] && <p className="auth-capability-note"><Icon name="shield" size={14} /> This login contract is ready for an endpoint path but is not configured in the current client environment.</p>}
      </form>
    </AuthShell>
  );
}

function LegacyRegisterPage() {
  const { register } = useAuth();
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    middleInitial: "",
    email: "",
    phoneNumber: "",
    barangay: "",
    municipalityOrCity: "",
    street: "",
    zipCode: "",
    password: "",
    confirm: "",
  });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const errors = {
    firstName: !values.firstName.trim() ? "First name is required." : !/^[A-Z]/.test(values.firstName.trim()) ? "First name must start with an uppercase letter." : "",
    lastName: !values.lastName.trim() ? "Last name is required." : !/^[A-Z]/.test(values.lastName.trim()) ? "Last name must start with an uppercase letter." : "",
    middleInitial: values.middleInitial && !/^[A-Z]$/.test(values.middleInitial.trim()) ? "Use one uppercase letter." : "",
    email: !values.email
      ? "Email is required."
      : !emailPattern.test(values.email) || !values.email.toLowerCase().endsWith("@gmail.com")
        ? "Enter a valid Gmail address."
        : "",
    phoneNumber: !values.phoneNumber ? "Phone number is required." : !phonePattern.test(values.phoneNumber.trim()) ? "Use 09XXXXXXXXX or +639XXXXXXXXX." : "",
    barangay: !values.barangay.trim() ? "Barangay is required." : "",
    municipalityOrCity: !values.municipalityOrCity.trim() ? "Municipality or city is required." : "",
    password: passwordError(values.password),
    confirm: !values.confirm
      ? "Confirm password is required."
      : values.password !== values.confirm
        ? "Passwords do not match."
        : "",
  };
  const update = (key) => (event) => {
    setValues({ ...values, [key]: event.target.value });
    setError("");
    setSuccess("");
  };
  const touch = (key) => setTouched({ ...touched, [key]: true });
  const submit = async (event) => {
    event.preventDefault();
    setTouched(
      Object.keys(errors).reduce((all, key) => ({ ...all, [key]: true }), {}),
    );
    if (Object.values(errors).some(Boolean)) {
      setError("Please correct the highlighted fields.");
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        middleInitial: values.middleInitial.trim() || undefined,
        email: values.email.trim(),
        phoneNumber: values.phoneNumber.trim(),
        address: {
          barangay: values.barangay.trim(),
          municipalityOrCity: values.municipalityOrCity.trim(),
          street: values.street.trim() || undefined,
          zipCode: values.zipCode.trim() || undefined,
        },
        password: values.password,
      });
      setLoading(false);
      setSuccess("Your Citizen account was created. Check your email for the verification link before signing in.");
    } catch (requestError) {
      setLoading(false);
      setError(requestError?.code === "ACCOUNT_EXISTS" ? "An account already uses this email address." : requestError?.code === "API_NOT_CONFIGURED" ? "Citizen registration is not connected in this client environment yet." : requestError?.code === "NETWORK_ERROR" ? "We couldn't reach SafeLink. Check your connection and try again." : "We couldn't create your account. Review your details and try again.");
    }
  };
  return (
    <AuthShell
      wide
      title="Create your citizen account"
      text="Join SafeLink to submit and privately track community reports."
      footer={
        <>
          Already registered? <Link to="/login/citizen">Citizen Sign In</Link>
        </>
      }
    >
      <form className="auth-form auth-form--grid" onSubmit={submit} noValidate>
        <Field
          id="first-name"
          label="First name"
          value={values.firstName}
          onChange={update("firstName")}
          onBlur={() => touch("firstName")}
          autoComplete="given-name"
          error={errors.firstName}
          touched={touched.firstName}
        />
        <Field
          id="last-name"
          label="Last name"
          value={values.lastName}
          onChange={update("lastName")}
          onBlur={() => touch("lastName")}
          autoComplete="family-name"
          error={errors.lastName}
          touched={touched.lastName}
        />
        <Field
          id="middle-initial"
          label={<>Middle initial <span>(optional)</span></>}
          value={values.middleInitial}
          onChange={update("middleInitial")}
          onBlur={() => touch("middleInitial")}
          autoComplete="additional-name"
          maxLength="1"
          error={errors.middleInitial}
          touched={touched.middleInitial}
        />
        <Field
          id="phone-number"
          label="Phone number"
          type="tel"
          value={values.phoneNumber}
          onChange={update("phoneNumber")}
          onBlur={() => touch("phoneNumber")}
          autoComplete="tel"
          placeholder="09123456789"
          error={errors.phoneNumber}
          touched={touched.phoneNumber}
        />
        <Field
          id="register-email"
          className="full"
          label="Email address"
          type="email"
          value={values.email}
          onChange={update("email")}
          onBlur={() => touch("email")}
          autoComplete="email"
          error={errors.email}
          touched={touched.email}
        />
        <Field
          id="barangay"
          label="Barangay"
          value={values.barangay}
          onChange={update("barangay")}
          onBlur={() => touch("barangay")}
          autoComplete="address-level3"
          error={errors.barangay}
          touched={touched.barangay}
        />
        <Field
          id="municipality-or-city"
          label="Municipality or city"
          value={values.municipalityOrCity}
          onChange={update("municipalityOrCity")}
          onBlur={() => touch("municipalityOrCity")}
          autoComplete="address-level2"
          error={errors.municipalityOrCity}
          touched={touched.municipalityOrCity}
        />
        <Field
          id="street"
          label={<>Street <span>(optional)</span></>}
          value={values.street}
          onChange={update("street")}
          onBlur={() => touch("street")}
          autoComplete="street-address"
        />
        <Field
          id="zip-code"
          label={<>ZIP code <span>(optional)</span></>}
          value={values.zipCode}
          onChange={update("zipCode")}
          onBlur={() => touch("zipCode")}
          autoComplete="postal-code"
          inputMode="numeric"
        />
        <p className="citizen-registration-note full"><Icon name="users" size={15} /><span><strong>Citizen registration only</strong> Barangay, LGU, Police, and Administrator accounts are issued through authorized SafeLink administration.</span></p>
        <div className="password-field">
          <PasswordField
            id="register-password"
            label="Password"
            value={values.password}
            onChange={update("password")}
            onBlur={() => touch("password")}
            autoComplete="new-password"
            error={errors.password}
            touched={touched.password}
          />
          <Rules value={values.password} />
        </div>
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={values.confirm}
          onChange={update("confirm")}
          onBlur={() => touch("confirm")}
          autoComplete="new-password"
          error={errors.confirm}
          touched={touched.confirm}
        />
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        {success && <p className="form-success full" role="status">{success}</p>}
        <LoadingButton loading={loading} loadingText="Creating account...">
          Create account
        </LoadingButton>
        {!accountApiCapabilities.registerCitizen && <p className="auth-capability-note full"><Icon name="shield" size={14} /> The Citizen Registration contract is ready for configuration but has no endpoint path in this client environment.</p>}
      </form>
    </AuthShell>
  );
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
  return <AuthShell title={presentation[1]} text="SafeLink Citizen account activation" footer={<>Return to <Link to="/login/citizen">Citizen Login</Link></>}>
    <section className={`verification-state is-${state.status}`} aria-live="polite" aria-busy={state.status === "verifying"}>
      <span><Icon name={presentation[0]} size={27} /></span><h3>{presentation[1]}</h3><p>{state.message}</p>
      {canResend && <form className="auth-form" onSubmit={resend} noValidate>
        <Field id="activation-resend-email" label="Email address" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setResendMessage(""); }} autoComplete="email" />
        <button className="button" type="submit" disabled={resending}>{resending ? "Sending…" : "Resend Verification Email"}</button>
        {resendMessage && <p className={resendMessage.startsWith("New verification") ? "form-success" : "form-error"} role="status">{resendMessage}</p>}
      </form>}
      {state.status !== "verifying" && <Link className="button button-muted" to="/login/citizen">{state.status === "success" ? "Continue to Citizen Login" : "Back to Citizen Login"} <Icon name="arrow" size={15} /></Link>}
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

