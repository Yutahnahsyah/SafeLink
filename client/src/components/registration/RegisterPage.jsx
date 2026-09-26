import { useMemo, useRef, useState } from "react";
import { registerCitizenAccount, applyPersonnelAccount } from "../../services/accountApi";
import { Link } from "../../routing";
import { AddressStep, JurisdictionStep, PersonalInfoStep, PersonnelRoleStep, RegisterRoleSelector, RegistrationReview, RegistrationSuccess, SecurityStep } from "./RegistrationSteps";
import { RegistrationActions, RegistrationShell, RegistrationStepper } from "./RegistrationShell";
import { citizenPayload, citizenSteps, initialRegistrationValues, personnelPayload, personnelRoles, personnelSteps, validateRegistration } from "./registrationConfig";
import "./RegistrationFlow.css";

const fieldsByStep = {
  citizen: [["firstName", "lastName", "middleInitial", "phoneNumber", "email"], ["municipalityOrCity", "barangay"], ["password", "confirmPassword"]],
  personnel: [["role"], ["firstName", "lastName", "middleInitial", "phoneNumber", "email"], ["municipalityOrCity", "barangay"], ["password", "confirmPassword"], []],
};

const selectorContext = { key: "selector", eyebrow: "SafeLink Registration", heading: "Join a trusted community safety network.", description: "Create a Citizen account or apply for authorized personnel access.", notice: "Administrator accounts are created only through internal SafeLink administration." };
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
  const [mode, setMode] = useState("");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ ...initialRegistrationValues });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [serverError, setServerError] = useState("");
  const errors = useMemo(() => validateRegistration(values, mode), [mode, values]);
  const steps = mode === "personnel" ? personnelSteps : citizenSteps;
  const stepFields = mode ? fieldsByStep[mode][step] : [];
  const stepValid = stepFields.every((field) => !errors[field]);
  const personnelConfig = personnelRoles[values.role];
  const context = mode === "citizen" ? citizenContext : mode === "personnel" && personnelConfig ? { key: values.role, eyebrow: `${personnelConfig.label} Application`, heading: personnelConfig.heading, description: personnelConfig.description, notice: "Applications remain pending until an authorized administrator approves access." } : selectorContext;

  const scrollTop = () => window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const update = (key) => (eventOrValue) => {
    const value = typeof eventOrValue === "string" ? eventOrValue : eventOrValue.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    setServerError("");
  };
  const touch = (key) => setTouched((current) => ({ ...current, [key]: true }));
  const markStepTouched = () => setTouched((current) => ({ ...current, ...Object.fromEntries(stepFields.map((field) => [field, true])) }));
  const chooseMode = (nextMode) => { setMode(nextMode); setStep(0); setServerError(""); scrollTop(); };
  const next = () => { markStepTouched(); if (!stepValid) return; setStep((current) => current + 1); scrollTop(); };
  const back = () => { if (step === 0) { setMode(""); } else { setStep((current) => current - 1); } setServerError(""); scrollTop(); };
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
      if (mode === "citizen") await registerCitizenAccount(citizenPayload(values));
      else await applyPersonnelAccount(personnelPayload(values));
      setCompletion({ email: values.email.trim().toLowerCase(), deliveryFailed: false });
      scrollTop();
    } catch (error) {
      if (mode === "citizen" && error?.code === "EMAIL_DELIVERY_FAILED" && error?.data?.accountCreated) {
        setCompletion({ email: values.email.trim().toLowerCase(), deliveryFailed: true });
        scrollTop();
      } else setServerError(messageFor(error, mode));
    } finally {
      setLoading(false);
    }
  };

  const title = !mode ? "How will you use SafeLink?" : mode === "citizen" ? "Create your Citizen account" : "Apply for Personnel Access";
  const copy = !mode ? "Choose the account path that matches how you will use the platform." : mode === "citizen" ? "A short, secure setup for reporting and tracking community concerns." : "Provide your identity and authorized jurisdiction for administrator review.";

  return <RegistrationShell context={context} title={title} copy={copy}>
    <div ref={topRef} className="registration-scroll-anchor" />
    {completion ? <RegistrationSuccess mode={mode} email={completion.email} deliveryFailed={completion.deliveryFailed} /> : !mode ? <>
      <RegisterRoleSelector onSelect={chooseMode} />
      <p className="auth-switch">Already registered? <Link to="/login">Return to Sign In</Link></p>
    </> : <form className="registration-flow" onSubmit={(event) => { if (step === steps.length - 1) submit(event); else { event.preventDefault(); next(); } }} noValidate>
      <RegistrationStepper steps={steps} current={step} />
      <div className="registration-step" key={`${mode}-${step}`}>
        {mode === "personnel" && step === 0 && <PersonnelRoleStep value={values.role} onSelect={update("role")} error={touched.role ? errors.role : ""} />}
        {((mode === "citizen" && step === 0) || (mode === "personnel" && step === 1)) && <PersonalInfoStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {mode === "citizen" && step === 1 && <AddressStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {mode === "personnel" && step === 2 && <JurisdictionStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {((mode === "citizen" && step === 2) || (mode === "personnel" && step === 3)) && <SecurityStep values={values} errors={errors} touched={touched} update={update} touch={touch} />}
        {mode === "personnel" && step === 4 && <RegistrationReview values={values} edit={edit} />}
      </div>
      {serverError && <p className="form-error" role="alert">{serverError}</p>}
      <RegistrationActions back={back} next={next} nextDisabled={!stepValid} submit={step === steps.length - 1} loading={loading} nextLabel={step === steps.length - 1 ? mode === "citizen" ? "Create Citizen Account" : "Submit Application" : "Continue"} />
    </form>}
  </RegistrationShell>;
}
