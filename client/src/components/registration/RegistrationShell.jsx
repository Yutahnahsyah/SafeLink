import BrandLogo from "../BrandLogo";
import Icon from "../Icon";
import { Link } from "../../routing";

export function RegistrationShell({ context, title, copy, children }) {
  return <main className={`auth-page registration-page registration-page--${context.key}`}>
    <section className="auth-aside registration-aside">
      <Link to="/"><BrandLogo showName={false} /></Link>
      <div><span>{context.eyebrow}</span><h1>{context.heading}</h1><p>{context.description}</p></div>
      <small><Icon name="shield" /> {context.notice}</small>
    </section>
    <section className="auth-panel registration-panel">
      <div className="auth-card auth-card--wide registration-card">
        <BrandLogo href="/" variant="auth" />
        <header className="auth-heading registration-heading"><h2>{title}</h2><p>{copy}</p></header>
        {children}
      </div>
    </section>
  </main>;
}

export function RegistrationStepper({ steps, current }) {
  return <ol className="registration-stepper" aria-label="Registration progress">
    {steps.map((step, index) => <li className={index < current ? "is-complete" : index === current ? "is-current" : ""} aria-current={index === current ? "step" : undefined} key={step}>
      <span>{index < current ? <Icon name="check" size={13} /> : index + 1}</span><small>{step}</small>
    </li>)}
  </ol>;
}

export function RegistrationActions({ back, next, nextLabel = "Continue", nextDisabled = false, loading = false, submit = false }) {
  return <div className="registration-actions">
    <button className="registration-back" type="button" onClick={back} disabled={loading}>Back</button>
    <button className="button" type={submit ? "submit" : "button"} onClick={submit ? undefined : next} disabled={nextDisabled || loading}>
      {loading ? <><span className="button-spinner" aria-hidden="true" />Submitting...</> : <>{nextLabel}<Icon name="arrow" size={16} /></>}
    </button>
  </div>;
}
