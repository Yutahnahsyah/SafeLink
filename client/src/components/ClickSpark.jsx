import { useCallback, useEffect, useRef } from "react";
import "./ClickSpark.css";

const editingControl = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]';

// Adapted from the React Bits ClickSpark source supplied for this integration.
export default function ClickSpark({
  sparkColor = "#fff",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = "ease-out",
  extraScale = 1,
  children,
}) {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const animationRef = useRef(null);
  const startRef = useRef(null);
  const stopRef = useRef(null);
  const reducedMotionRef = useRef(false);

  const easeFunc = useCallback(
    (t) => {
      switch (easing) {
        case "linear":
          return t;
        case "ease-in":
          return t * t;
        case "ease-in-out":
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const clear = () => {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      sparksRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.remove("is-active");
    };
    const resize = () => {
      clear();
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const updateMotion = () => {
      reducedMotionRef.current = motion.matches;
      if (motion.matches) clear();
    };
    const draw = (timestamp) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;
        const eased = easeFunc(Math.max(0, elapsed) / duration);
        const distance = eased * sparkRadius * extraScale;
        const length = sparkSize * (1 - eased);
        const cos = Math.cos(spark.angle);
        const sin = Math.sin(spark.angle);
        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spark.x + distance * cos, spark.y + distance * sin);
        ctx.lineTo(
          spark.x + (distance + length) * cos,
          spark.y + (distance + length) * sin,
        );
        ctx.stroke();
        return true;
      });
      animationRef.current = sparksRef.current.length
        ? requestAnimationFrame(draw)
        : null;
      if (animationRef.current === null) canvas.classList.remove("is-active");
    };
    startRef.current = () => {
      canvas.classList.add("is-active");
      if (animationRef.current === null)
        animationRef.current = requestAnimationFrame(draw);
    };
    stopRef.current = clear;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    updateMotion();
    motion.addEventListener("change", updateMotion);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    document.addEventListener("visibilitychange", clear);
    return () => {
      clear();
      startRef.current = null;
      stopRef.current = null;
      observer.disconnect();
      motion.removeEventListener("change", updateMotion);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", clear, true);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [sparkColor, sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  const handleClick = (event) => {
    // Keyboard activation has no pointer location; preserve its normal behavior.
    if (
      reducedMotionRef.current ||
      event.detail === 0 ||
      event.target.closest?.(editingControl) ||
      duration <= 0 ||
      sparkCount <= 0
    )
      return;
    const canvas = canvasRef.current;
    if (!canvas || !startRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const count = Math.floor(sparkCount);
    const now = performance.now();
    const sparks = Array.from({ length: count }, (_, index) => ({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      angle: (2 * Math.PI * index) / count,
      startTime: now,
    }));
    sparksRef.current.push(...sparks);
    startRef.current();
  };

  return (
    <div className="click-spark" onClickCapture={handleClick}
      onPointerOverCapture={(event) => { if (event.target.closest?.(editingControl)) stopRef.current?.(); }}
      onFocusCapture={(event) => { if (event.target.closest?.(editingControl)) stopRef.current?.(); }}>
      <canvas
        ref={canvasRef}
        className="click-spark__canvas"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
