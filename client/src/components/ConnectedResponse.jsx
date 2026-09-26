import PangasinanNetwork from "./PangasinanNetwork";
import "./SafeLinkGlobe.css";

const steps = [
  ["Report", "Citizens raise a concern."],
  ["Verify", "Barangay personnel review."],
  ["Coordinate", "LGU teams assign a response."],
  ["Respond", "Partner agencies take action."],
];

export default function ConnectedResponse() {
  return (
    <section
      className="section connected-response"
      aria-labelledby="connected-response-title"
    >
      <div className="container connected-response-layout">
        <div className="connected-response-copy">
          <span className="section-label">Connected response network</span>
          <h2 id="connected-response-title">
            One Community.
            <br />
            <span>One Connected Response.</span>
          </h2>
          <p>
            SafeLink connects citizens and authorized personnel through a
            centralized system for reporting, verification, coordination, and
            incident response.
          </p>
          <ol className="network-workflow">
            {steps.map(([title, detail], index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="network-demo-note">
            Illustrative network. Locations shown on the homepage represent the
            SafeLink response workflow and are not live incident data.
          </p>
        </div>
        <PangasinanNetwork />
      </div>
    </section>
  );
}
