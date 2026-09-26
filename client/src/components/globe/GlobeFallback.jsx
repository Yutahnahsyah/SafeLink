import BrandLogo from "../BrandLogo";

export default function GlobeFallback() {
  return (
    <div
      className="network-globe-fallback"
      role="img"
      aria-label="Connected communities and coordinated response"
    >
      <div className="network-fallback-orbit" aria-hidden="true">
        <BrandLogo variant="loading" showName={false} />
        <i />
        <i />
        <i />
      </div>
      <strong>Connected Communities.</strong>
      <span>Coordinated Response.</span>
    </div>
  );
}
