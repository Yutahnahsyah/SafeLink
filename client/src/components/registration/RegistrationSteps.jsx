import { useState } from "react";
import Icon from "../Icon";
import { Link } from "../../routing";
import { authApi } from "../../services/safelinkApi";
import { MunicipalityField, PasswordRequirements, RegistrationField, RegistrationPasswordField } from "./RegistrationFields";
import CitizenLocationFields from './CitizenLocationFields';

export function PersonalInfoStep({ values, errors, touched, update, touch }) {
  return <div className="auth-form auth-form--grid registration-form-grid">
    <RegistrationField id="registration-first-name" label="First Name" value={values.firstName} onChange={update("firstName")} onBlur={() => touch("firstName")} error={errors.firstName} touched={touched.firstName} autoComplete="given-name" />
    <RegistrationField id="registration-last-name" label="Last Name" value={values.lastName} onChange={update("lastName")} onBlur={() => touch("lastName")} error={errors.lastName} touched={touched.lastName} autoComplete="family-name" />
    <RegistrationField id="registration-middle-initial" label="Middle Initial" optional value={values.middleInitial} onChange={update("middleInitial")} onBlur={() => touch("middleInitial")} error={errors.middleInitial} touched={touched.middleInitial} autoComplete="additional-name" maxLength="1" />
    <RegistrationField id="registration-phone" label="Phone Number" value={values.phoneNumber} onChange={update("phoneNumber")} onBlur={() => touch("phoneNumber")} error={errors.phoneNumber} touched={touched.phoneNumber} type="tel" inputMode="tel" autoComplete="tel" placeholder="09123456789" />
    <RegistrationField id="registration-email" label="Email Address" className="full" value={values.email} onChange={update("email")} onBlur={() => touch("email")} error={errors.email} touched={touched.email} type="email" autoComplete="email" />
  </div>;
}

export function AddressStep({ values, errors, touched, update, touch, barangays, selectStreet }) {
  return <div className="auth-form auth-form--grid registration-form-grid">
    <p className="registration-province-note full"><Icon name="pin" size={18} /> Province: <strong>Pangasinan</strong></p>
    <MunicipalityField value={values.municipalityOrCity} onChange={update("municipalityOrCity")} onBlur={() => touch("municipalityOrCity")} error={errors.municipalityOrCity} touched={touched.municipalityOrCity} />
    <CitizenLocationFields values={values} errors={errors} touched={touched} update={update} touch={touch} barangays={barangays} selectStreet={selectStreet} />
    <RegistrationField id="registration-landmark" label="Nearby Landmark" optional value={values.landmark} onChange={update("landmark")} onBlur={() => touch("landmark")} />
    <RegistrationField id="registration-zip" className="full" label="ZIP Code" value={values.zipCode} readOnly aria-readonly="true" autoComplete="postal-code" />
  </div>;
}

export function SecurityStep({ values, errors, touched, update, touch }) {
  return <div className="auth-form auth-form--grid registration-form-grid registration-security-grid">
    <div><RegistrationPasswordField id="registration-password" label="Password" value={values.password} onChange={update("password")} onBlur={() => touch("password")} error={errors.password} touched={touched.password} autoComplete="new-password" /><PasswordRequirements value={values.password} /></div>
    <RegistrationPasswordField id="registration-confirm-password" label="Confirm Password" value={values.confirmPassword} onChange={update("confirmPassword")} onBlur={() => touch("confirmPassword")} error={errors.confirmPassword} touched={touched.confirmPassword} autoComplete="new-password" />
  </div>;
}

export function RegistrationSuccess({ email, deliveryFailed = false }) {
  const [delivery, setDelivery] = useState(deliveryFailed ? "failed" : "sent");
  const [resending, setResending] = useState(false);
  const resend = async () => {
    setResending(true);
    try { await authApi.resendVerification(email); setDelivery("sent"); }
    catch (error) { setDelivery(error?.code === "RESEND_COOLDOWN" ? "cooldown" : "failed"); }
    finally { setResending(false); }
  };
  return <section className="registration-success" role="status">
    <span><Icon name={delivery === "failed" ? "priority" : "check"} size={30} /></span>
    <h3>{delivery === "failed" ? "Account created?email not sent" : "Account created"}</h3>
    <p>{delivery === "failed" ? "Your account was created, but we couldn't send the verification email. You can try sending it again." : delivery === "cooldown" ? "Please wait a moment before requesting another verification email." : "Please verify your email before signing in."}</p>
    {delivery !== "sent" && <button className="button" type="button" disabled={resending} onClick={resend}>{resending ? "Sending?" : "Resend verification email"}</button>}
    <Link className="button" to="/login">Return to Sign In <Icon name="arrow" size={16} /></Link>
  </section>;
}
