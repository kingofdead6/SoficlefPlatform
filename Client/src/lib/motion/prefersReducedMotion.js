/**
 * Shared reduced-motion check for GSAP / anime.js code (Framer Motion has its own
 * useReducedMotion() hook — this is only needed for the two JS-driven animation libs,
 * since the global CSS rule in index.css only catches CSS transitions/animations).
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
