// The original hero easing and duration, isolated so lifecycle cleanup is testable.
export function observeCountUp(element, value, onDisplay, environment = window) {
  let started = false, stopped = false, finished = false, frame, start;
  const media = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  const finish = () => {
    if (stopped || finished) return;
    finished = true;
    environment.cancelAnimationFrame?.(frame);
    onDisplay(value);
  };
  const tick = time => {
    if (stopped || finished) return;
    start ??= time;
    const progress = Math.min((time - start) / 900, 1);
    if (progress === 1) return finish();
    onDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
    frame = environment.requestAnimationFrame(tick);
  };
  const enter = () => {
    if (started || stopped) return;
    started = true;
    observer?.disconnect();
    if (media?.matches || !environment.requestAnimationFrame) finish();
    else frame = environment.requestAnimationFrame(tick);
  };
  const onMotionChange = event => { if (event.matches && started) finish(); };
  const observer = environment.IntersectionObserver
    ? new environment.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) enter();
    }, { threshold: 0.5 }) : null;
  media?.addEventListener?.('change', onMotionChange);
  if (observer) observer.observe(element);
  else { started = true; finish(); }
  return () => {
    stopped = true;
    observer?.disconnect();
    environment.cancelAnimationFrame?.(frame);
    media?.removeEventListener?.('change', onMotionChange);
  };
}
