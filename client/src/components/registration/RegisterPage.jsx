import { useMemo, useRef, useState } from "react";
import { registerCitizenAccount } from "../../services/accountApi";
import { Link, useRouter } from "../../routing";
import { AddressStep, PersonalInfoStep, RegistrationSuccess, SecurityStep } from "./RegistrationSteps";
import { RegistrationActions, RegistrationShell, RegistrationStepper } from "./RegistrationShell";
import { citizenPayload, citizenSteps, initialRegistrationValues, validateRegistration } from "./registrationConfig";
import { updateRegistrationValue } from '../../services/registrationLocationState';
import { useRegistrationLocations } from '../../services/useRegistrationLocations';
import LegalDocumentModal from './LegalDocumentModal';
import "./RegistrationFlow.css";

const fieldsByStep = {
  citizen: [["firstName", "lastName", "middleInitial", "phoneNumber", "email"], ["municipalityOrCity", "barangay", "street"], ["password", "confirmPassword", "legalAccepted"]],
};

const citizenContext = { key: "citizen", eyebrow: "Citizen Registration", heading: "Community safety starts with trusted information.", description: "Submit reports, follow verified updates, and stay connected with local response activity.", notice: "Citizen accounts require email verification before sign in." };

function messageFor(error, mode) {
  if (error?.code === "ACCOUNT_EXISTS") return "An account already uses this email address.";
  if (error?.code === "NETWORK_ERROR") return "We couldn't reach SafeLink. Check your connection and try again.";
  if (error?.code === "SERVER_ERROR") return "SafeLink couldn't process this request right now. Please try again later.";
  if (error?.code === "API_NOT_CONFIGURED") return `${mode === "citizen" ? "Citizen registration" : "Personnel applications"} are not connected in this environment.`;
  return "We couldn't submit your information. Review the form and try again.";
}

export default function RegisterPage() {
  const topRef = useRef(null);
  const mode = "citizen";
  const { navigate } = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ ...initialRegistrationValues });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [serverError, setServerError] = useState("");
  const [serverFields, setServerFields] = useState({});
  const [legalDocument, setLegalDocument] = useState(null);
  const barangays = useRegistrationLocations('barangays', values.municipalityOrCity, '', mode === 'citizen');
  const errors = useMemo(() => ({ ...validateRegistration(values, mode, barangays.data), ...serverFields }), [mode, values, barangays.data, serverFields]);
  const steps = citizenSteps;
  const stepFields = mode ? fieldsByStep[mode][step] : [];
  const stepValid = stepFields.every((field) => !errors[field]);
  const context = citizenContext;

  const scrollTop = () => window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: "start" }));
  const update = (key) => (eventOrValue) => {
    const value = ['string', 'boolean'].includes(typeof eventOrValue) ? eventOrValue : eventOrValue.target.value;
    setValues((current) => updateRegistrationValue(current, key, value, mode));
    setServerFields((current) => Object.fromEntries(Object.entries(current).filter(([field]) => field !== key && !(key === 'municipalityOrCity' && ['barangay', 'street'].includes(field)) && !(key === 'barangay' && field === 'street'))));
    setServerError("");
  };
  const selectStreet = (street) => {
    setValues((current) => ({ ...current, street, streetSuggestionContext: `${current.municipalityOrCity}:${current.barangay}` }));
    setServerFields((current) => { const next = { ...current }; delete next.street; return next; });
    setTouched((current) => ({ ...current, street: true }));
  };
  const touch = (key) => setTouched((current) => ({ ...current, [key]: true }));
  const markStepTouched = () => setTouched((current) => ({ ...current, ...Object.fromEntries(stepFields.map((field) => [field, true])) }));
  const next = () => { markStepTouched(); if (!stepValid) return; setStep((current) => current + 1); scrollTop(); };
  const back = () => { if (step === 0) { navigate("/login"); } else { setStep((current) => current - 1); } setServerError(""); scrollTop(); };
  const edit = (target) => { setStep(target); setServerError(""); scrollTop(); };
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const allFields = Object.keys(errors);
    setTouched(Object.fromEntries(allFields.map((field) => [field, true])));
    if (allFields.some((field) => errors[field])) { setServerError("Please correct the highlighted fields before submitting."); return; }
    setLoading(true);
    setServerError("");
    try {
      await registerCitizenAccount(citizenPayload(values));
      setCompletion({ email: values.email.trim().toLowerCase(), deliveryFailed: false });
      scrollTop();
    } catch (error) {
      if (mode === "citizen" && error?.code === "EMAIL_DELIVERY_FAILED" && error?.data?.accountCreated) {
        setCompletion({ email: values.email.trim().toLowerCase(), deliveryFailed: true });
        scrollTop();
      } else {
        const fields = Object.fromEntries((error.fieldErrors || []).map(({ field, message }) => [field.startsWith('legalAcceptance') ? 'legalAccepted' : field.replace(/^address\./, ''), message]));
        setServerFields(fields);
        if (fields.legalAccepted) setStep(2);
        if (mode === 'citizen' && ['municipalityOrCity', 'barangay', 'street'].some((field) => fields[field])) setStep(1);
        setServerError(messageFor(error, mode));
      }
    } finally {
      setLoading(false);
    }
  };

  return <RegistrationShell context={context} title="Create your Citizen account" copy="Register as a Citizen to report concerns and follow verified community updates.">
    <div ref={topRef} className="registration-scroll-anchor" />
    {completion ? <RegistrationSuccess mode="citizen" email={completion.email} deliveryFailed={completion.deliveryFailed} /> : <form className="registration-flow" onSubmit={(event) => { if (step === steps.length - 1) submit(event); else { event.preventDefault(); next(); } }} noValidate>
      <RegistrationStepper steps={steps} current={step} />
      <div className="registration-step" key={`${mode}-${step}`}>
        {step === 0 && <PersonalInfoStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {step === 2 && <SecurityStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {mode === "citizen" && step === 1 && <AddressStep values={values} errors={errors} touched={touched} update={update} touch={touch} barangays={barangays} selectStreet={selectStreet} />}
      </div>
      {step === 2 && <div className="registration-agreement">
        <div className="registration-agreement-row">
          <input id="registration-legal-acceptance" type="checkbox" required checked={values.legalAccepted} onChange={(event) => update('legalAccepted')(event.target.checked)} onBlur={() => touch('legalAccepted')} aria-labelledby="registration-agreement-label" aria-invalid={Boolean(touched.legalAccepted && errors.legalAccepted)} aria-describedby={touched.legalAccepted && errors.legalAccepted ? 'registration-agreement-error' : undefined} />
          <div id="registration-agreement-label"><label htmlFor="registration-legal-acceptance">I have read and agree to the </label><button type="button" className="registration-legal-link" aria-haspopup="dialog" aria-controls="registration-legal-dialog" onClick={() => setLegalDocument('terms')}>Terms and Conditions</button> and acknowledge the <button type="button" className="registration-legal-link" aria-haspopup="dialog" aria-controls="registration-legal-dialog" onClick={() => setLegalDocument('privacy')}>Privacy Policy</button>.</div>
        </div>
        {touched.legalAccepted && errors.legalAccepted && <p id="registration-agreement-error" className="field-error" role="alert">{errors.legalAccepted}</p>}
      </div>}
      {serverError && <p className="form-error" role="alert">{serverError}</p>}
      <RegistrationActions back={back} next={next} submit={step === steps.length - 1} loading={loading} nextLabel={step === steps.length - 1 ? "Create Citizen Account" : "Continue"} />
    </form>}
    <p className="auth-switch">Already registered? <Link to="/login">Sign In</Link></p>
    {legalDocument && <LegalDocumentModal document={legalDocument} onDismiss={() => setLegalDocument(null)} />}
  </RegistrationShell>;
}
