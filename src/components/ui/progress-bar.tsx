'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';

import { DURATION, GSAP_EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * A progress bar, from the prototype's checklist.
 *
 * `role="progressbar"` with the aria-value triple, plus a written percentage, so the
 * figure is available to a screen reader and not only to the eye (ADR-030).
 *
 * The fill grows to its width with GSAP rather than a CSS transition, because it has to
 * animate on first paint as well as on change: a CSS transition from a server-rendered
 * width has no "from" state and simply appears. The ARIA value is set from the props and
 * never touched by the animation — assistive technology gets the real number immediately,
 * whatever the fill is doing.
 */
export function ProgressBar({
  value,
  label,
  detail,
  className,
}: {
  /** 0–100. */
  value: number;
  label: string;
  detail?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = fill.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      node.style.inlineSize = `${clamped}%`;
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        node,
        { width: 0 },
        { width: `${clamped}%`, duration: DURATION.slow, ease: GSAP_EASE_OUT },
      );
    }, node);

    return () => context.revert();
  }, [clamped]);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-text-muted text-[12px]">{label}</span>
        <span className="text-red-brand font-mono text-[12px] tabular-nums">
          {detail ? `${detail} · ` : ''}
          {clamped}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full border border-(--border) bg-(--surface2)"
      >
        <div
          ref={fill}
          className="h-full rounded-full bg-linear-to-r from-(--red-brand) to-(--red-accent)"
          // Server-rendered at the real width, so the bar is correct before hydration and
          // in a printout; the effect takes over from there.
          style={{ inlineSize: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
