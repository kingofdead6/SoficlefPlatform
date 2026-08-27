'use client';

import { useEffect, useRef, useState } from 'react';

import { DURATION_MS, prefersReducedMotion } from '@/lib/motion';

/**
 * A circular completion gauge.
 *
 * SVG rather than a CSS conic gradient: the arc has to be readable by assistive
 * technology, and a gradient is decoration with no value to announce. The whole thing is
 * one `role="img"` with a label, so a screen reader hears "Parcours complété à 40 %" and
 * not a list of path elements.
 *
 * The sweep animates from zero on mount, unless the reader has asked for reduced motion —
 * in which case it simply renders at its final value (ADR-029's sibling rule for JS).
 */
export function ProgressRing({
  percent,
  size = 96,
  label = 'Parcours complété',
}: {
  percent: number;
  size?: number;
  label?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));

  /*
   * First paint shows the real value; the sweep is decoration layered on afterwards.
   *
   * Initialising to zero and correcting in the effect meant every reader saw 0% for a
   * frame — including those who asked for reduced motion, who then saw it jump. Rendering
   * the truth first and animating only when motion is welcome is both correct and cheaper.
   */
  const [shown, setShown] = useState(safe);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / DURATION_MS.slow);
      // Ease-out: fast at first, settling at the end, so the number reads as arriving
      // rather than as still counting.
      setShown(Math.round(safe * (1 - Math.pow(1 - elapsed, 3))));
      if (elapsed < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [safe]);

  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="img"
      aria-label={`${label} à ${safe} %`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--red-brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * shown) / 100}
          /* Start the arc at twelve o'clock rather than three. */
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        aria-hidden="true"
        className="text-text absolute inset-0 flex items-center justify-center font-mono text-[15px] font-medium"
      >
        {shown}%
      </span>
    </div>
  );
}
