import BrandLogo from './BrandLogo';
import Footer from './Footer';
import Icon from './Icon';
import { Link } from '../routing';
import policies from '../../../shared/legalPolicies.json';
import { privacySections, termsSections } from '../legal/policies-2026-10-17.1';
import './LegalPages.css';

export function LegalReviewNotice() {
  return <aside className="legal-review" aria-label="Operator review required"><strong>Operator review required before public deployment</strong><p>Verified operator and privacy contact details, retention rules and organizational procedures are pending confirmation. These documents describe the current implementation and do not certify legal compliance.</p></aside>;
}

export function LegalDocumentContent({ document = 'terms', idPrefix = '' }) {
  const privacy = document === 'privacy';
  const sections = privacy ? privacySections : termsSections;
  return <>{sections.map(({id,title,paragraphs}) => <section key={id} id={`${idPrefix}${id}`} tabIndex={-1}><h2>{title}</h2>{paragraphs.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</section>)}
    {privacy && <section id={`${idPrefix}privacy-references`}><h2>Official privacy references</h2><p><a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noopener noreferrer">Republic Act No. 10173 — National Privacy Commission (new tab)</a></p><p><a href="https://privacy.gov.ph/data-subject-rights/" target="_blank" rel="noopener noreferrer">Data subject rights — National Privacy Commission (new tab)</a></p></section>}
  </>;
}

export default function LegalPage({ document = 'terms' }) {
  const privacy = document === 'privacy';
  const title = privacy ? 'Privacy Policy' : 'Terms and Conditions';
  const sections = privacy ? privacySections : termsSections;
  return <>
    <header className="legal-header"><BrandLogo href="/" /><nav aria-label="Legal navigation"><Link to="/login">Sign In</Link><Link to="/register">Citizen Registration</Link></nav></header>
    <main className="legal-page" id="legal-top">
      <div className="legal-hero"><span className="legal-eyebrow"><Icon name="shield" size={18} /> SafeLink · Trust &amp; transparency</span><h1>{title}</h1><p>{privacy ? 'Understand what SafeLink collects, how information is used and what still needs operator review.' : 'Understand your responsibilities when using SafeLink to report community safety concerns.'}</p><div className="legal-meta"><span>Version {privacy ? policies.privacyVersion : policies.termsVersion}</span><span>Last updated: <time dateTime={policies.updatedAt}>17 October 2026</time></span></div></div>
      <LegalReviewNotice />
      <div className="legal-layout"><nav className="legal-contents" aria-label={`${title} contents`}><h2>On this page</h2>{sections.map(({id,title:heading}) => <a key={id} href={`#${id}`}>{heading}</a>)}<Link className="legal-related" to={privacy ? '/terms-and-conditions' : '/privacy-policy'}>Read the {privacy ? 'Terms and Conditions' : 'Privacy Policy'} <Icon name="arrow" size={15} /></Link></nav>
        <article className="legal-document" aria-label={title}><LegalDocumentContent document={document} />
          <div className="legal-actions"><Link to="/register">Back to Citizen registration</Link><a href="#legal-top">Back to top ↑</a></div><p className="legal-return-note">Opened from a registration form? Close this tab to return to your saved-in-memory entries in the original tab.</p>
        </article>
      </div>
    </main><Footer />
  </>;
}

export function TermsPage() { return <LegalPage />; }
export function PrivacyPage() { return <LegalPage document="privacy" />; }
