import "./BrandLogo.css";

const sizes = new Set([
  "navigation",
  "mobile",
  "dashboard",
  "auth",
  "loading",
  "footer",
]);

/** Reuses the original artwork unchanged. Pass the real home/dashboard route as href. */
export default function BrandLogo({
  variant = "navigation",
  href,
  showName = true,
  onClick,
  label = "SafeLink home",
}) {
  const size = sizes.has(variant) ? variant : "navigation";
  const Tag = href ? "a" : "div";
  return (
    <Tag
      className={`safelink-brand safelink-brand--${size}`}
      href={href}
      onClick={onClick}
      aria-label={href ? label : undefined}
    >
      <span className="safelink-brand__surface">
        <img
          src="/brand/safelink-logo.png"
          width="1080"
          height="859"
          alt={showName ? "" : "SafeLink"}
          decoding="async"
        />
      </span>
      {showName && (
        <span className="safelink-brand__name">
          Safe<span>Link</span>
        </span>
      )}
    </Tag>
  );
}
