import { useLayoutEffect } from 'react';
import gsap from 'gsap';

import { prefersReducedMotion } from './prefersReducedMotion.js';

/**
 * Runs `buildAnimation(context, reduced)` inside a gsap.context() scoped to `scopeRef`,
 * reverting all tweens on unmount/deps-change. `reduced` is passed in so callers can
 * skip/shorten timelines instead of the hook silently no-op'ing (empty data should still
 * render final, visible state).
 *
 * @param {import('react').RefObject} scopeRef - container ref GSAP selectors are scoped to
 * @param {(ctx: { gsap: typeof gsap, scope: HTMLElement }, reduced: boolean) => void} buildAnimation
 * @param {any[]} deps
 */
export function useGsapContext(scopeRef, buildAnimation, deps = []) {
  useLayoutEffect(() => {
    if (!scopeRef.current) return undefined;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => {
      buildAnimation({ gsap, scope: scopeRef.current }, reduced);
    }, scopeRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
