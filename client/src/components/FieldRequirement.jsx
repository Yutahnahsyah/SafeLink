import './FieldRequirement.css';

export default function FieldRequirement({ optional = false, children }) {
  const text = children || (optional ? 'Optional' : 'Required');
  const kind = children ? 'is-info' : optional ? 'is-optional' : 'is-required';
  return <small className={`field-requirement ${kind}`}>{text}</small>;
}
