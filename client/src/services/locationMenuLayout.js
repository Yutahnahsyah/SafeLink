// Coordinates are relative to the layout viewport, including a mobile keyboard's
// reduced visual viewport. Menus never need a hard-coded label/field offset.
export function locationMenuLayout(rect, viewport) {
  const margin = 12;
  const gap = 6;
  const bottom = viewport.top + viewport.height - margin;
  const above = Math.max(0, rect.top - gap - viewport.top - margin);
  const below = Math.max(0, bottom - rect.bottom - gap);
  const upward = below < 180 && above > below;
  const width = Math.min(rect.width, Math.max(0, viewport.width - margin * 2));
  return {
    left: Math.max(viewport.left + margin, Math.min(rect.left, viewport.left + viewport.width - margin - width)),
    top: upward ? rect.top - gap : rect.bottom + gap,
    width,
    maxHeight: Math.min(280, upward ? above : below),
    upward,
  };
}
