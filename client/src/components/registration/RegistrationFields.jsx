import { useState } from "react";
import Icon from "../Icon";
import FieldRequirement from "../FieldRequirement";
import { pangasinanLocations } from "../../data/pangasinanLocations";
import { passwordRequirements } from "./registrationConfig";

export function RegistrationFeedback({ id, invalid, error, helper }) {
  return <span className="registration-feedback">{invalid
    ? <span className="field-error" id={`${id}-error`} role="alert">{error}</span>
    : helper ? <small id={`${id}-help`} className="registration-location-helper">{helper}</small> : null}</span>;
}

export function RegistrationField({ id, label, optional = false, requirement, error, touched, className = "", ...props }) {
  const invalid = Boolean(touched && error);
  return <label className={`registration-field ${className} ${invalid ? "has-error" : ""}`} htmlFor={id}>
    <span id={`${id}-label`} className="registration-label field-label-row">{label}{requirement !== null && <FieldRequirement optional={optional}>{requirement}</FieldRequirement>}</span>
    <input id={id} aria-labelledby={`${id}-label`} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} required={!optional && requirement !== null && !props.readOnly} {...props} />
    <RegistrationFeedback id={id} invalid={invalid} error={error} />
  </label>;
}

export function MunicipalityField({ value, onChange, onBlur, error, touched }) {
  const invalid = Boolean(touched && error);
  return <label className={`registration-field ${invalid ? "has-error" : ""}`} htmlFor="registration-municipality">
    <span id="registration-municipality-label" className="registration-label field-label-row">Municipality / City<FieldRequirement /></span>
    <select id="registration-municipality" aria-labelledby="registration-municipality-label" value={value} onChange={onChange} onBlur={onBlur} aria-invalid={invalid} aria-describedby={invalid ? "registration-municipality-error" : undefined} required>
      <option value="">Select municipality or city</option>
      {pangasinanLocations.map(({ name }) => <option value={name} key={name}>{name}</option>)}
    </select>
    <RegistrationFeedback id="registration-municipality" invalid={invalid} error={error} />
  </label>;
}

export function RegistrationPasswordField({ id, label, error, touched, ...props }) {
  const [visible, setVisible] = useState(false);
  const invalid = Boolean(touched && error);
  return <div className={`registration-field password-field ${invalid ? "has-error" : ""}`}>
    <label className="registration-label field-label-row" htmlFor={id}>{label}<FieldRequirement /></label>
    <div className="password-input">
      <input id={id} type={visible ? "text" : "password"} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} required {...props} />
      <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}><Icon name="eye" size={18} /></button>
    </div>
    <RegistrationFeedback id={id} invalid={invalid} error={error} />
  </div>;
}

export function PasswordRequirements({ value }) {
  return <ul className="password-rules registration-password-rules" aria-label="Password requirements">
    {passwordRequirements.map(({ key, label, test }) => <li className={test(value) ? "is-valid" : ""} key={key}><Icon name="check" size={14} />{label}</li>)}
  </ul>;
}
