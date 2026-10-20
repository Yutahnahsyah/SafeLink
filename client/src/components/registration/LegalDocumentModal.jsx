import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LegalDocumentContent, LegalReviewNotice } from '../LegalPages';
import policies from '../../../../shared/legalPolicies.json';
import './LegalDocumentModal.css';

export default function LegalDocumentModal({ document: documentType, onDismiss }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const timer = useRef(null);
  const [closing, setClosing] = useState(false);
  const privacy = documentType === 'privacy';
  const title = privacy ? 'Privacy Policy' : 'Terms and Conditions';
  useEffect(() => {
    const modal = dialog.current;
    const opener = window.document.activeElement;
    const oldOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    modal.showModal();
    closeButton.current.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
      if (modal.open) modal.close();
      window.document.body.style.overflow = oldOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const dismiss = () => {
    if (closing) return;
    const finish = () => { dialog.current?.close(); onDismiss(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    setClosing(true);
    timer.current = setTimeout(finish, 240);
  };
  const containFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if ((event.shiftKey && window.document.activeElement === first) || (!event.shiftKey && window.document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus({ preventScroll: true });
    }
  };
  return createPortal(<dialog id="registration-legal-dialog" ref={dialog} className={`registration-legal-dialog${closing ? ' is-closing' : ''}`} aria-labelledby="registration-legal-title" aria-modal="true" onKeyDown={containFocus} onCancel={(event) => { event.preventDefault(); dismiss(); }}>
    <header><div><span>SafeLink · Read before agreeing</span><h2 id="registration-legal-title">{title}</h2><p>Version {privacy ? policies.privacyVersion : policies.termsVersion} · Updated <time dateTime={policies.updatedAt}>17 October 2026</time></p></div><button ref={closeButton} type="button" className="registration-legal-close" onClick={dismiss} aria-label={`Close ${title}`} disabled={closing}>Close <span aria-hidden="true">×</span></button></header>
    <div className="registration-legal-reading" tabIndex={0} role="region" aria-label={`${title} reading area`}>
      <LegalReviewNotice />
      <article className="legal-document" aria-label={title}><LegalDocumentContent document={documentType} idPrefix="registration-modal-" /></article>
    </div>
    <footer><span>Closing this document does not select the agreement checkbox.</span><a href={privacy ? '/privacy-policy' : '/terms-and-conditions'} target="_blank" rel="noopener noreferrer">Open separate page<span className="sr-only"> (new tab)</span></a></footer>
  </dialog>, window.document.body);
}
