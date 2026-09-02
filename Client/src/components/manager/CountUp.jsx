import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

import { prefersReducedMotion } from '../../lib/motion/prefersReducedMotion.js';

/**
 * anime.js-driven number count-up. Renders a <span> whose textContent is tweened from 0
 * to `value`. Used for KPI/stat values (ManagerReportsPage) and recruit percentages.
 * Owns the numeric text of its element exclusively — no other library touches it.
 */
export default function CountUp({ value, suffix = '', decimals = 0, duration = 900, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const target = typeof value === 'number' && Number.isFinite(value) ? value : 0;

    if (prefersReducedMotion()) {
      el.textContent = `${target.toFixed(decimals)}${suffix}`;
      return undefined;
    }

    const counter = { val: 0 };
    const anim = animate(counter, {
      val: target,
      duration,
      ease: 'outExpo',
      onUpdate: () => {
        el.textContent = `${counter.val.toFixed(decimals)}${suffix}`;
      },
    });

    return () => anim.pause?.();
  }, [value, suffix, decimals, duration]);

  return <span ref={ref} className={className}>0{suffix}</span>;
}
