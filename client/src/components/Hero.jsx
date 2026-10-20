import Icon from "./Icon";
import PublicResolvedMap from "./PublicResolvedMap";
import HeroStatistics from "./HeroStatistics";
import { Link } from "../routing";

export default function Hero() {
  return (
    <section id="home" className="hero hero--centered">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-location-lines" aria-hidden="true" />
      <div className="container hero-center">
        <div className="hero-intro reveal">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> Community safety, connected
          </div>
          <h1>Report. Verify. <span>Respond.</span></h1>
          <p className="hero-lede">
            One connected platform where citizens can report safety concerns and
            authorized personnel can verify, coordinate, track, and respond.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/login?next=/citizen/report">
              Report an incident <Icon name="arrow" size={17} />
            </Link>
            <Link className="button button-secondary" to="/safety-map">
              <Icon name="map" size={18} /> Explore safety map
            </Link>
          </div>
        </div>
        <HeroStatistics />
        <div className="hero-map-shell reveal delay-1">
          <div className="map-frame hero-map-frame">
            <div className="map-topbar"><span><span className="live-dot" /> Live community safety map</span></div>
            <PublicResolvedMap heroMode />
          </div>
        </div>
      </div>
    </section>
  );
}
