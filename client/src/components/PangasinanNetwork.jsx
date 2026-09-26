import { useRef } from "react";
import { responseNetwork, responseNetworkLegend } from "../data/responseNetwork";
import SafeLinkMap, { PANGASINAN_BOUNDS } from "./maps/SafeLinkMap";
import "./SafeLinkGlobe.css";

export default function PangasinanNetwork() {
  const mapRef = useRef(null);

  const focusPangasinan = () => {
    mapRef.current?.fitBounds(PANGASINAN_BOUNDS, {
      padding: [24, 24],
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      duration: 0.65,
    });
  };

  return (
    <div className="local-network">
      <div className="local-network__stage">
        <SafeLinkMap
          mode="network"
          items={responseNetwork}
          mapRef={mapRef}
          interactive
        />
        <div className="local-network__heading" aria-hidden="true">
          <span>Pangasinan response network</span>
          <span><i /> Illustrative locations</span>
        </div>
        <button className="network-focus-button" type="button" onClick={focusPangasinan}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2Zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
          </svg>
          Focus Pangasinan
        </button>
      </div>
      <div className="network-legend" aria-label="Network marker legend">
        {responseNetworkLegend.map(({ category, label }) => (
          <span className={`network-legend__item network-legend__item--${category}`} key={category}>
            <i aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
