# SafeLink brand assets

`safelink-logo.png` is a byte-for-byte copy of the supplied 1080 × 859 PNG.
SHA-256: `27dd44687ced958fbf9c24b173e4a0e1a3bc6f560acd201f51479506666a8211`.
Keep its original proportions, colors, wordmark, and background intact.

The source includes its own light background; no transparent or symbol-only
artwork was supplied. Components place the original on a white surface rather
than applying filters or removing any lettering. `safelink-app-icon.svg` contains
the same PNG embedded unchanged and centered on a square white surface. It does
not trace, crop, stretch, or redraw the logo.

`BrandLogo` provides navigation (42px image height, 34px on mobile), mobile
(34px), dashboard (38px), auth (84px), loading (80px), and footer (34px) variants.
Pass `href` explicitly for the real home/dashboard destination and use
`showName={false}` when the artwork is presented on its own above a form.

Examples for future pages (these routes/pages do not exist yet):

```jsx
<BrandLogo variant="auth" showName={false} />
<BrandLogo variant="dashboard" href={dashboardHome} label="SafeLink dashboard" />
```

UI theme: `src/brand-theme.css`. Canvas/map palette: `src/branding.js`.
Navy `#022350` and teal `#03b1b8` were sampled from the source artwork.
The darker teal `#007d85` is a UI-only contrast treatment behind white text.
