import "./Skeleton.css";

export function SkeletonBlock({ className = "", ...props }) {
  return (
    <span
      className={`skeleton-block ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MapSkeleton({ compact = false }) {
  return (
    <div
      className={`map-skeleton ${compact ? "map-skeleton--compact" : ""}`}
      role="status"
      aria-label="Loading map"
    >
      <div className="map-skeleton__controls" aria-hidden="true">
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
      {!compact && (
        <div className="map-skeleton__filters" aria-hidden="true">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      )}
      <span className="sr-only">Loading map</span>
    </div>
  );
}

export function GlobeSkeleton() {
  return (
    <div
      className="globe-skeleton"
      role="status"
      aria-label="Loading community network"
    >
      <div className="globe-skeleton__sphere" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="globe-skeleton__lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <span className="sr-only">Loading community network</span>
    </div>
  );
}
