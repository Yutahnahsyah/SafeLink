import { useState } from "react";
import Icon from "../Icon";
import { Link } from "../../routing";
import { authApi } from "../../services/safelinkApi";
import { MunicipalityField, PasswordRequirements, RegistrationField, RegistrationPasswordField } from "./RegistrationFields";
import { personnelRoles } from "./registrationConfig";

export function RegisterRoleSelector({ onSelect }) {
  return <section className="registration-choice-grid" aria-label="Choose how you will use SafeLink">
    <button type="button" onClick={() => onSelect("citizen")}><span><Icon name="report" size={24} /></span><div><strong>Citizen</strong><p>Report and track community safety concerns.</p></div><Icon name="arrow" size={17} /></button>
    <button type="button" onClick={() => onSelect("personnel")}><span><Icon name="shield" size={24} /></span><div><strong>Authorized Personnel</strong><p>Apply for Barangay, LGU, or Police access.</p></div><Icon name="arrow" size={17} /></button>
  </section>;
}

export function PersonnelRoleStep({ value, onSelect, error }) {
  return <section className="registration-role-grid" aria-label="Choose personnel role">
    {Object.entries(personnelRoles).map(([role, config]) => <button className={value === role ? "is-selected" : ""} type="button" aria-pressed={value === role} onClick={() => onSelect(role)} key={role}>
      <span><Icon name={config.icon} size={22} /></span><strong>{config.label}</strong><p>{config.copy}</p><i>{value === role ? <Icon name="check" size={14} /> : null}</i>
    </button>)}
    {error && <p className="form-error registration-grid-error" role="alert">{error}</p>}
  </section>;
}

export function PersonalInfoStep({ values, errors, touched, update, touch }) {
  return <div className="auth-form auth-form--grid registration-form-grid">
    <RegistrationField id="registration-first-name" label="First Name" value={values.firstName} onChange={update("firstName")} onBlur={() => touch("firstName")} error={errors.firstName} touched={touched.firstName} autoComplete="given-name" />
    <RegistrationField id="registration-last-name" label="Last Name" value={values.lastName} onChange={update("lastName")} onBlur={() => touch("lastName")} error={errors.lastName} touched={touched.lastName} autoComplete="family-name" />
    <RegistrationField id="registration-middle-initial" label="Middle Initial" optional value={values.middleInitial} onChange={update("middleInitial")} onBlur={() => touch("middleInitial")} error={errors.middleInitial} touched={touched.middleInitial} autoComplete="additional-name" maxLength="1" />
    <RegistrationField id="registration-phone" label="Phone Number" value={values.phoneNumber} onChange={update("phoneNumber")} onBlur={() => touch("phoneNumber")} error={errors.phoneNumber} touched={touched.phoneNumber} type="tel" inputMode="tel" autoComplete="tel" placeholder="09123456789" />
    <RegistrationField id="registration-email" label="Email Address" className="full" value={values.email} onChange={update("email")} onBlur={() => touch("email")} error={errors.email} touched={touched.email} type="email" autoComplete="email" />
  </div>;
}

export function AddressStep({ values, errors, touched, update, touch }) {
  return <div className="auth-form auth-form--grid registration-form-grid">
    <MunicipalityField value={values.municipalityOrCity} onChange={update("municipalityOrCity")} onBlur={() => touch("municipalityOrCity")} error={errors.municipalityOrCity} touched={touched.municipalityOrCity} />
    <RegistrationField id="registration-barangay" label="Barangay" value={values.barangay} onChange={update("barangay")} onBlur={() => touch("barangay")} error={errors.barangay} touched={touched.barangay} autoComplete="address-level3" />
    <RegistrationField id="registration-street" label="Street / Landmark" optional value={values.street} onChange={update("street")} onBlur={() => touch("street")} autoComplete="street-address" />
    <RegistrationField id="registration-zip" label="ZIP Code" optional value={values.zipCode} onChange={update("zipCode")} onBlur={() => touch("zipCode")} inputMode="numeric" autoComplete="postal-code" />
  </div>;
}

export function JurisdictionStep({ values, errors, touched, update, touch }) {
  const needsBarangay = values.role === "barangay_personnel";
  return <div className="auth-form auth-form--grid registration-form-grid">
    <p className="registration-jurisdiction-note full"><Icon name="shield" size={17} /><span><strong>Jurisdiction-scoped access</strong>Your SafeLink access will be restricted to your authorized jurisdiction.</span></p>
    <MunicipalityField value={values.municipalityOrCity} onChange={update("municipalityOrCity")} onBlur={() => touch("municipalityOrCity")} error={errors.municipalityOrCity} touched={touched.municipalityOrCity} />
    {needsBarangay && <RegistrationField id="registration-barangay" label="Barangay" value={values.barangay} onChange={update("barangay")} onBlur={() => touch("barangay")} error={errors.barangay} touched={touched.barangay} autoComplete="address-level3" />}
  </div>;
}

export function SecurityStep({ values, errors, touched, update, touch }) {
  return <div className="auth-form auth-form--grid registration-form-grid registration-security-grid">
    <div><RegistrationPasswordField id="registration-password" label="Password" value={values.password} onChange={update("password")} onBlur={() => touch("password")} error={errors.password} touched={touched.password} autoComplete="new-password" /><PasswordRequirements value={values.password} /></div>
    <RegistrationPasswordField id="registration-confirm-password" label="Confirm Password" value={values.confirmPassword} onChange={update("confirmPassword")} onBlur={() => touch("confirmPassword")} error={errors.confirmPassword} touched={touched.confirmPassword} autoComplete="new-password" />
  </div>;
}

export function RegistrationReview({ values, edit }) {
  const role = personnelRoles[values.role];
  const name = [values.firstName, values.middleInitial ? `${values.middleInitial}.` : "", values.lastName].filter(Boolean).join(" ");
  const jurisdiction = [values.role === "barangay_personnel" ? values.barangay : "", values.municipalityOrCity, "Pangasinan"].filter(Boolean).join(", ");
  return <section className="registration-review">
    <dl>
      <div><dt>Account Type</dt><dd>{role?.label}</dd></div>
      <div><dt>Name</dt><dd>{name}</dd></div>
      <div><dt>Email</dt><dd>{values.email}</dd></div>
      <div><dt>Jurisdiction</dt><dd>{jurisdiction}</dd></div>
      <div><dt>Account Status After Submission</dt><dd><span className="registration-pending-badge">Pending Administrator Approval</span></dd></div>
    </dl>
    <div><button type="button" onClick={() => edit(1)}>Edit Personal Information</button><button type="button" onClick={() => edit(2)}>Edit Jurisdiction</button></div>
  </section>;
}

export function RegistrationSuccess({ mode, email, deliveryFailed = false }) {
  const personnel = mode === "personnel";
  const [delivery, setDelivery] = useState(deliveryFailed ? "failed" : "sent");
  const [resending, setResending] = useState(false);
  const resend = async () => {
    setResending(true);
    try { await authApi.resendVerification(email); setDelivery("sent"); }
    catch (error) { setDelivery(error?.code === "RESEND_COOLDOWN" ? "cooldown" : "failed"); }
    finally { setResending(false); }
  };
  return <section className="registration-success" role="status">
    <span><Icon name={!personnel && delivery === "failed" ? "priority" : "check"} size={30} /></span>
    {personnel && <b>Pending Review</b>}
    <h3>{personnel ? "Application submitted" : delivery === "failed" ? "Account created—email not sent" : "Account created"}</h3>
    <p>{personnel ? "Your personnel account is awaiting SafeLink administrator approval." : delivery === "failed" ? "Your account was created, but we couldn't send the verification email. You can try sending it again." : delivery === "cooldown" ? "Please wait a moment before requesting another verification email." : "Please verify your email before signing in."}</p>
    {personnel && <small>You will be able to access the personnel workspace after your account has been verified and approved.</small>}
    {!personnel && delivery !== "sent" && <button className="button" type="button" disabled={resending} onClick={resend}>{resending ? "Sending…" : "Resend verification email"}</button>}
    <Link className="button" to={personnel ? "/login" : "/login/citizen"}>Return to Sign In <Icon name="arrow" size={16} /></Link>
  </section>;
}
