import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import { Link } from "../routing";

export function CTA() {
  return (
    <section id="report" className="cta-section">
      <div className="container">
        <div className="cta-card observe">
          <div className="cta-glow" />
          <span className="section-label">
            Your report can make a difference
          </span>
          <h2>Help build a safer community.</h2>
          <p>
            Report concerns, stay informed, and help local authorities respond
            more effectively.
          </p>
          <div>
            <Link className="button button-light" to="/login/citizen?next=/citizen/report">
              Report an incident <Icon name="arrow" size={17} />
            </Link>
            <Link className="button button-outline" to="/register">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Footer() {
  return (
    <footer id="contact">
      <div className="container footer-main">
        <div className="footer-brand">
          <BrandLogo variant="footer" href="/" />
          <p>
            A Web-Based Verified Community Safety Reporting &amp; Assistance
            System
          </p>
        </div>
        <div className="footer-links">
          <div>
            <strong>Platform</strong>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/features">Features</Link>
            <Link to="/safety-map">Safety Map</Link>
          </div>
          <div>
            <strong>Support</strong>
            <Link to="/safety">Safety information</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/login">Citizen login</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          <Icon name="priority" size={15} /> SafeLink does not replace emergency
          dispatch services. For immediate emergencies, contact the appropriate
          emergency authority.
        </p>
        <span>© {new Date().getFullYear()} SafeLink. All rights reserved.</span>
      </div>
    </footer>
  );
}
