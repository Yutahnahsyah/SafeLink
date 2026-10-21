import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { locationMenuLayout } from '../../services/locationMenuLayout';
import { RegistrationFeedback } from './RegistrationFields';
import Icon from '../Icon';
import FieldRequirement from '../FieldRequirement';
import './RegistrationLocations.css';

function Highlight({ name, query }) {
  const index = name.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return name;
  return <>{name.slice(0, index)}<mark>{name.slice(index, index + query.trim().length)}</mark>{name.slice(index + query.trim().length)}</>;
}
export default function LocationCombobox({ id, label, value, onChange, onSelect = onChange, onBlur, options, status, retry, error, touched, disabled = false, placeholder, emptyText, helper, freeText = false, maxLength = 100, source }) {
  const listId = useId();
  const input = useRef(null);
  const field = useRef(null);
  const popup = useRef(null);
  const list = useRef(null);
  const ignoreFocus = useRef(false);
  const [position, setPosition] = useState(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const invalid = Boolean(touched && error);
  const search = freeText ? value : query;
  const filtered = freeText ? options : options.filter((name) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  useEffect(() => { if (!open) setQuery(value); }, [value, open]);
  useEffect(() => { if (disabled) { setOpen(false); setClosing(false); setActive(-1); setQuery(value); } }, [disabled]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    const option = document.getElementById(`${listId}-${active}`);
    const menu = list.current;
    if (!option || !menu) return;
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
  }, [active, listId]);
  useLayoutEffect(() => {
    if (!open || disabled) return undefined;
    const update = () => {
      const viewport = window.visualViewport;
      const rect = input.current.getBoundingClientRect();
      const bounds = { left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0, width: viewport?.width || window.innerWidth, height: viewport?.height || window.innerHeight };
      if (rect.bottom < bounds.top || rect.top > bounds.top + bounds.height) { close(); return; }
      setPosition(locationMenuLayout(rect, bounds));
    };
    const scroll = (event) => { if (!popup.current?.contains(event.target)) update(); };
    const outside = (event) => { if (!field.current?.contains(event.target) && !popup.current?.contains(event.target)) close(); };
    update();
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, disabled]);
  const show = () => { clearTimeout(closeTimer.current); setClosing(false); setOpen(true); };
  const close = () => {
    clearTimeout(closeTimer.current);
    setActive(-1);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOpen(false); return; }
    setClosing(true);
    closeTimer.current = setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  };
  const select = (name) => { clearTimeout(closeTimer.current); onSelect(name); setQuery(name); setActive(-1); setOpen(false); setClosing(false); if (document.activeElement !== input.current) { ignoreFocus.current = true; input.current?.focus({ preventScroll: true }); } };
  const keyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); show();
      setActive((current) => filtered.length ? current < 0 ? event.key === 'ArrowDown' ? 0 : filtered.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : -1);
    }
    if (event.key === 'Enter' && open && !closing) {
      event.preventDefault();
      if (active >= 0 && filtered[active]) select(filtered[active]);
    }
  };
  return <div ref={field} className={`registration-field registration-location-field ${invalid ? 'has-error' : ''}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !popup.current?.contains(event.relatedTarget)) { close(); onBlur?.(); } }}>
    <label className="registration-label field-label-row" htmlFor={id}>{label}<FieldRequirement /></label>
    <div className="registration-location-input"><Icon name="search" size={17} /><input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && !closing} aria-controls={open ? listId : undefined} aria-activedescendant={open && !closing && active >= 0 && filtered[active] ? `${listId}-${active}` : undefined} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : `${id}-help`} autoComplete="off" required disabled={disabled} maxLength={maxLength} placeholder={placeholder} value={freeText ? value : open ? query : value} onFocus={() => { if (ignoreFocus.current) { ignoreFocus.current = false; return; } setQuery(freeText ? value : ''); show(); }} onKeyDown={keyDown} onChange={(event) => {
      const text = event.target.value;
      setQuery(text); setActive(-1); show();
      if (freeText) onChange(text); else if (value) onChange('');
    }} />{!freeText && value && <span className="location-selection-indicator" aria-label="Selected"><Icon name="check" size={16} /></span>}</div>
    {open && !disabled && position && createPortal(<div ref={popup} style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, transform: position.upward ? 'translateY(-100%)' : undefined }} data-placement={position.upward ? 'top' : 'bottom'} className={`registration-location-popup${closing ? ' is-closing' : ''}`}>
      {status === 'loading' ? <p role="status"><span className="button-spinner" aria-hidden="true" /> Loading {freeText ? 'street suggestions' : 'barangays'}…</p> : status === 'error' ? <div><p role="status">{freeText ? 'Suggestions are unavailable. You can type your street manually.' : 'Barangays could not be loaded.'}</p><button type="button" onClick={retry}>Retry {freeText ? 'suggestions' : 'barangays'}</button></div> : !filtered.length ? <p role="status">{emptyText}</p> : null}
      <ul ref={list} id={listId} role="listbox" aria-label={`${label} suggestions`}>{status === 'success' && filtered.map((name, index) => <li id={`${listId}-${index}`} key={name} role="option" aria-selected={value === name} className={index === active ? 'is-highlighted' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => select(name)} onPointerMove={(event) => { if (event.pointerType === 'mouse') setActive(index); }}><span><Highlight name={name} query={search} /></span>{value === name && <Icon name="check" size={15} />}</li>)}</ul>
      {source && <a className="location-source" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}
    </div>, document.body)}
    <RegistrationFeedback id={id} invalid={invalid} error={error} helper={helper} />
    {!open && status === 'error' && !disabled && <button type="button" className="location-retry" onClick={() => { show(); retry(); }}>Retry {freeText ? 'street suggestions' : 'barangays'}</button>}
  </div>;
}
