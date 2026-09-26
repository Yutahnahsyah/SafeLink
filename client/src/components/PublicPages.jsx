import { useMemo, useState } from "react";
import Navbar from "./Navbar";
import Hero from "./Hero";
import {
  About,
  HowItWorks,
  Features,
  IncidentTimeline,
  CommunityMap,
  UserRoles,
  Analytics,
} from "./Sections";
import Footer, { CTA } from "./Footer";
import ConnectedResponse from "./ConnectedResponse";
import Icon from "./Icon";
import SafetyMap from "./SafetyMap";
import { Link } from "../routing";
import { emergencyContacts, emergencyContactTypes, provincialEmergencyContacts } from "../data/emergencyContacts";
import { pangasinanLocations } from "../data/pangasinanLocations";

const faqs = [
  [
    "Is SafeLink an emergency dispatch service?",
    "No. For an immediate threat to life or property, contact the appropriate emergency service first. SafeLink supports verified community reporting and coordinated follow-up.",
  ],
  [
    "Can people see who submitted a report?",
    "No. Public map entries never display reporter names, contact details, evidence, or exact private locations.",
  ],
  [
    "What happens after I submit a report?",
    "The report enters validation, may be verified and assigned, and can then progress through response to resolution. You will receive status updates in your account.",
  ],
  [
    "Can I track my report?",
    "Yes. Signed-in citizens can see their own reports, public response updates, and status history. Internal or confidential notes are never shown.",
  ],
  [
    "What evidence can I attach?",
    "You may attach relevant photos or short videos. Avoid placing yourself in danger or capturing unnecessary personal information.",
  ],
];

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
function PageHero({ eyebrow, title, text }) {
  return (
    <section className="public-page-hero">
      <div className="container">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <PublicLayout>
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <ConnectedResponse />
        <Features />
        <IncidentTimeline />
        <CommunityMap />
        <UserRoles />
        <Analytics />
        <SafetyInfo compact />
        <FAQ compact />
        <CTA />
      </main>
    </PublicLayout>
  );
}

export function AboutPage() {
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="About SafeLink"
          title="Community safety works better when everyone stays connected."
          text="SafeLink gives citizens and authorized response teams one accountable path from concern to coordinated action."
        />
        <About />
        <ConnectedResponse />
        <UserRoles />
        <CTA />
      </main>
    </PublicLayout>
  );
}
export function HowPage() {
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="How it works"
          title="A clear path from report to resolution."
          text="Structured reporting, responsible verification, coordinated response, and transparent citizen updates—all in one workflow."
        />
        <HowItWorks />
        <IncidentTimeline />
        <CTA />
      </main>
    </PublicLayout>
  );
}
export function FeaturesPage() {
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="Main features"
          title="Focused tools for safer, better-informed communities."
          text="SafeLink balances useful public information with protected reporting and role-based workflows."
        />
        <Features />
        <Analytics />
        <CTA />
      </main>
    </PublicLayout>
  );
}

export function PublicMapPage() {
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="Public community safety map"
          title="Useful awareness without exposing private information."
          text="Map entries are generalized and anonymized. Reporter identity, private evidence, exact residential locations, and internal response notes are never public."
        />
        <section className="section public-map-page">
          <div className="container">
            <div className="privacy-notice">
              <Icon name="shield" />
              <div>
                <strong>Privacy-protected public view</strong>
                <span>
                  Locations are approximate and details are limited to public
                  safety information.
                </span>
              </div>
            </div>
            <div className="public-map-large">
              <SafetyMap compact showFilters />
              <div className="map-legend">
                <span>
                  <i className="red" />
                  Urgent
                </span>
                <span>
                  <i className="orange" />
                  Verifying
                </span>
                <span>
                  <i className="blue" />
                  Assigned
                </span>
                <span>
                  <i className="green" />
                  Resolved
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export function SafetyInfo({ compact = false }) {
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [query, setQuery] = useState("");
  const [contactType, setContactType] = useState("all");
  const selectedKey = selectedLocation.toLowerCase().replace(/ city$/, "").replace(/[^a-z]+/g, "-");
  const matchingLocations = pangasinanLocations.filter((location) => location.name.toLowerCase().includes(locationQuery.trim().toLowerCase()));
  const localRecord = selectedLocation ? emergencyContacts[selectedKey] : null;
  const contacts = useMemo(() => {
    const local = localRecord?.contacts || [];
    const normalizedQuery = query.trim().toLowerCase();
    return local.filter((contact) => (contactType === "all" || contact.type === contactType) && `${contact.agency} ${contact.type} ${selectedLocation}`.toLowerCase().includes(normalizedQuery));
  }, [contactType, localRecord, query, selectedLocation]);
  const callNumber = (number) => number.replace(/[^\d+]/g, "");
  const contactCard = (contact) => (
    <article className="emergency-contact-card" key={contact.id || contact.agency}>
      <span className="emergency-contact-type">{contact.type}</span>
      <h3>{contact.agency}</h3>
      <p>{contact.description}</p>
      {contact.facilityHead && <p className="contact-detail"><strong>Facility head:</strong> {contact.facilityHead}</p>}
      {contact.address && <p className="contact-detail"><strong>Address:</strong> {contact.address}</p>}
      {contact.numbers?.length ? <div className="emergency-numbers">{contact.numbers.map((number) => <a href={`tel:${callNumber(number)}`} key={number}>{number}</a>)}</div> : <span className="contact-unavailable">No verified number available yet.</span>}
      {contact.numbers?.length ? <div className="emergency-call-actions">{contact.numbers.map((number) => <a className="button button-sm" href={`tel:${callNumber(number)}`} key={`call-${number}`}>Call <Icon name="phone" size={14} /></a>)}</div> : null}
      <small className={`contact-source ${contact.verified ? "is-verified" : ""}`}>{contact.verified ? "Verified contact" : "Pending verification"} · {contact.source || contact.verifiedDate} {contact.lastVerified ? `· Last verified: ${contact.lastVerified}` : ""}</small>
    </article>
  );
  const content = (
    <div className="container">
      <div className="info-heading">
        <span className="section-label">Safety information</span>
        <h2>Know who to contact across Pangasinan.</h2>
        <p>
          SafeLink supports community reporting but does not replace emergency hotlines or dispatch services.
        </p>
      </div>
      <div className="emergency-notice"><Icon name="priority" size={18} /><span>If there is an immediate threat to life or safety, contact 911 or the appropriate emergency service directly. SafeLink is a reporting and coordination platform and does not perform emergency dispatch.</span></div>
      <section className="provincial-emergency-section">
        <div className="emergency-section-heading"><div><span className="section-label">Province-wide emergency contacts</span><h3>For immediate emergencies</h3></div><span className="contact-verification">Verify periodically with official sources</span></div>
        <div className="emergency-grid">{provincialEmergencyContacts.map(contactCard)}</div>
      </section>
      {!compact && <section className="local-emergency-section" id="local-emergency-contacts">
        <div className="emergency-section-heading"><div><span className="section-label">Find local emergency contacts</span><h3>Choose a city or municipality</h3></div></div>
        <div className="emergency-search-row"><label>City / Municipality<input list="pangasinan-location-options" value={locationQuery} onChange={(event) => { const nextValue = event.target.value; const match = pangasinanLocations.find((location) => location.name.toLowerCase() === nextValue.trim().toLowerCase()); setLocationQuery(nextValue); setSelectedLocation(match?.name || ""); setQuery(""); setContactType("all"); }} placeholder="Search or select a location..." /><datalist id="pangasinan-location-options">{matchingLocations.map((location) => <option value={location.name} key={location.name}>{location.type === "city" ? "City" : "Municipality"}</option>)}</datalist></label><label>Search emergency contacts<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agency or emergency type..." /></label><label>Contact type<select value={contactType} onChange={(event) => setContactType(event.target.value)}><option value="all">All contact types</option><option value="Disaster / Rescue">Rescue</option>{emergencyContactTypes.filter((type) => type !== "Disaster / Rescue").map((type) => <option key={type}>{type}</option>)}</select></label></div>
        {selectedLocation ? <div className="emergency-local-results"><div className="emergency-results-heading"><h3>{selectedLocation} contacts</h3><span>{localRecord?.verified ? "Verified contacts" : "No verified contacts"}</span></div>{contacts.length ? <div className="emergency-grid">{contacts.map(contactCard)}</div> : <div className="emergency-empty">No verified local emergency contacts have been added for this area yet. For immediate emergencies, call 911.</div>}</div> : <div className="emergency-empty">Search or select one of the 48 Pangasinan cities and municipalities to view local contacts.</div>}
      </section>}
      {compact && (
        <div className="safety-actions" aria-label="Safety information actions">
          <Link className="safety-action safety-action--primary" to="/safety">
            View all safety information <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
      <a
        className="official-source"
        href="https://www.pangasinan.gov.ph/"
        target="_blank"
        rel="noreferrer"
      >
        Verify contacts with official Pangasinan sources
      </a>
    </div>
  );
  if (compact)
    return <section className="section safety-info-section">{content}</section>;
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="Safety information"
          title="Prepared, informed, and ready to act."
          text="Save important contact numbers and always prioritize immediate emergency services when life or property is at risk."
        />
        <section className="section safety-info-section">{content}</section>
      </main>
    </PublicLayout>
  );
}

export function FAQ({ compact = false }) {
  const visible = compact ? faqs.slice(0, 3) : faqs;
  const content = (
    <div className="container">
      <div className="info-heading">
        <span className="section-label">Frequently asked questions</span>
        <h2>Clear answers about reporting and privacy.</h2>
      </div>
      <div className="faq-list">
        {visible.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <span>+</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      {compact && (
        <Link className="text-link" to="/faq">
          See all questions <Icon name="arrow" size={16} />
        </Link>
      )}
    </div>
  );
  if (compact)
    return <section className="section faq-section">{content}</section>;
  return (
    <PublicLayout>
      <main>
        <PageHero
          eyebrow="FAQ"
          title="How can we help?"
          text="Learn how SafeLink handles reports, public information, citizen updates, and privacy."
        />
        <section className="section faq-section">{content}</section>
      </main>
    </PublicLayout>
  );
}
