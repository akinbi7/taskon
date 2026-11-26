import { useEffect, useRef, useState } from "react";
import { formatPoints } from "../lib/format";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function PointsCountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => (reducedMotion() ? value : 0));
  const previous = useRef(reducedMotion() ? value : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (reducedMotion() || from === value) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const duration = from === 0 ? 850 : 620;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  return <span className={className}>{formatPoints(display)}</span>;
}
