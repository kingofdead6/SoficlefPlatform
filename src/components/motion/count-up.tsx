'use client';

import { animate, cubicBezier } from 'animejs';
import { useEffect, useRef } from 'react';

import { DURATION_MS, EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * Anime.js — a figure that counts up to its value.
 *
 * Anime.js is the right engine for this one thing: it tweens a plain JavaScript object
 * and hands back the intermediate values, which is exactly what a counter needs. Framer
 * Motion animates DOM properties, and GSAP would work but brings a timeline engine to a
 * problem that is one number moving.
 *
 * Three details matter more than the effect:
 *
 *   - The final value is rendered on the server. A counter that starts from a client
 *     effect would leave the tile blank in the HTML, so the number would be missing for
 *     a crawler, a printout, and the instant before hydration.
 *   - It runs once, when scrolled into view. A KPI that re-counts on every re-render is
 *     a distraction on a dashboard somebody keeps open.
 *   - `aria-hidden` on the animating span, with the real value in a visually-hidden one:
 *     a screen reader should hear "12", not eleven intermediate numbers.
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // A ref rather than state: this guard decides whether an effect runs, and nothing
  // renders from it. Holding it in state would mean a setState inside the effect and a
  // second render that produces identical output.
  const hasRun = useRef(false);

  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const node = ref.current;
    if (!node || hasRun.current) return;

    // Nothing to animate towards, or a reader who asked for stillness. The value is
    // already rendered, so there is nothing to do but leave it.
    if (!Number.isFinite(value) || prefersReducedMotion()) {
      hasRun.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        hasRun.current = true;

        // Reset to zero only now, a frame before the tween starts. Doing it during render
        // would blank the server-rendered value; doing it never would make the animation
        // jump from the final number back to zero and up again.
        const counter = { n: 0 };
        node.textContent = format(0);
        animate(counter, {
          n: value,
          duration: DURATION_MS.slow,
          ease: cubicBezier(...EASE_OUT),
          onUpdate: () => {
            node.textContent = format(counter.n);
          },
          // Land exactly on the target: floating-point tweening can stop a hair short,
          // and "99.9%" where the data says 100% is a reporting error, not a rounding one.
          onComplete: () => {
            node.textContent = format(value);
          },
        });
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
    // `format` is derived from the props below; re-running on its identity would restart
    // the count on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix, prefix]);

  /*
   * One element, not two.
   *
   * The obvious approach — a visually-hidden span holding the true value beside an
   * aria-hidden span doing the counting — puts the number in the document twice. It is
   * hidden from sight but not from the text layer, so the tile reads "1
1" to
   * `innerText`, to a copy-paste, and to anything scraping the page.
   *
   * `role="img"` with an `aria-label` collapses the element to a single announcement of
   * the real value, whatever the visible text says while the tween is running.
   */
  return (
    <span
      ref={ref}
      role="img"
      aria-label={format(value)}
      className={className}
      // Server-rendered at the final value, so the figure is right before hydration,
      // in a printout, and if the effect never runs.
    >
      {format(value)}
    </span>
  );
}