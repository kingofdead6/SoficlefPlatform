import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

import { prefersReducedMotion } from '../../lib/motion/prefersReducedMotion.js';

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * anime.js-driven circular progress ring for per-recruit onboarding completion.
 * Owns the SVG circle's stroke-dashoffset exclusively (no CSS transition on it, no
 * Framer Motion animating this element's own properties — only the wrapping card uses FM).
 */
export default function ProgressRing({ percent = 0, tone = 'brand', label }) {
  const circleRef = useRef(null);
  const clampedPercent = Math.max(0, Math.min(100, percent ?? 0));

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return undefined;

    const targetOffset = CIRCUMFERENCE - (clampedPercent / 100) * CIRCUMFERENCE;

    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = String(targetOffset);
      return undefined;
    }

    el.style.strokeDashoffset = String(CIRCUMFERENCE);
    const anim = animate(el, {
      strokeDashoffset: targetOffset,
      duration: 1000,
      delay: 150,
      ease: 'outExpo',
    });

    return () => anim.pause?.();
  }, [clampedPercent]);

  const strokeColor =
    tone === 'red' ? 'var(--color-status-red)' : tone === 'green' ? 'var(--color-status-green)' : 'var(--color-red-brand)';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={STROKE}
        />
        <circle
          ref={circleRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
        />
      </svg>
      <span className="absolute font-ui text-xs font-semibold text-text">
        {label ?? `${clampedPercent}%`}
      </span>
    </div>
  );
}
