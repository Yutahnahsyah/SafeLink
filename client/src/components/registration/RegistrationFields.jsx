import { useState } from "react";
import Icon from "../Icon";
import { pangasinanLocations } from "../../data/pangasinanLocations";
import { passwordRequirements } from "./registrationConfig";

export function RegistrationField({ id, label, optional = false, error, touched, className = "", ...props }) {
  const invalid = Boolean(touched && error);
  return <label className={`${className} ${invalid ? "has-error" : touched ? "is-valid" : ""}`} htmlFor={id}>
    <span className="registration-label">{label}{optional && <small>Optional</small>}</span>
    <input id={id} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} {...props} />
    {invalid && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
  </label>;
}

export function MunicipalityField({ value, onChange, onBlur, error, touched }) {
  const invalid = Boolean(touched && error);
  return <label className={invalid ? "has-error" : touched ? "is-valid" : ""} htmlFor="registration-municipality">
    <span className="registration-label">Municipality / City</span>
    <select id="registration-municipality" value={value} onChange={onChange} onBlur={onBlur} aria-invalid={invalid} aria-describedby={invalid ? "registration-municipality-error" : undefined}>
      <option value="">Select municipality or city</option>
      {pangasinanLocations.map(({ name }) => <option value={name} key={name}>{name}</option>)}
    </select>
    {invalid && <span className="field-error" id="registration-municipality-error" role="alert">{error}</span>}
  </label>;
}

export function RegistrationPasswordField({ id, label, error, touched, ...props }) {
  const [visible, setVisible] = useState(false);
  const invalid = Boolean(touched && error);
  return <div className={`password-field ${invalid ? "has-error" : touched ? "is-valid" : ""}`}>
    <label htmlFor={id}>{label}</label>
    <div className="password-input">
      <input id={id} type={visible ? "text" : "password"} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} {...props} />
      <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}><Icon name="eye" size={18} /></button>
    </div>
    {invalid && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
  </div>;
}

export function PasswordRequirements({ value }) {
  return <ul className="password-rules registration-password-rules" aria-label="Password requirements">
    {passwordRequirements.map(({ key, label, test }) => <li className={test(value) ? "is-valid" : ""} key={key}><Icon name="check" size={14} />{label}</li>)}
  </ul>;
}
