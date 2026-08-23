/**
 * The shared motion vocabulary.
 *
 * Three engines animate this application — Framer Motion for React component and layout
 * transitions, GSAP for orchestrated timelines, Anime.js for numeric counters — and
 * without a common source of truth they would each invent their own durations and
 * curves, which reads as three different products stitched together.
 *
 * So the numbers live here, matching `--duration-*` and `--ease-*` in tokens.css, and
 * every engine is fed from this module.
 *
 * The durations are short on purpose. CDC v0.1 §18 asks for navigation that feels
 * instantaneous, and §13 for "sérieux, stable, rapide": motion here is meant to explain
 * where something came from, never to make the reader wait for it.
 */

/** Seconds — GSAP and Framer Motion both take seconds. */
export const DURATION = {
  fast: 0.14,
  base: 0.24,
  slow: 0.42,
} as const;

/** Milliseconds — Anime.js takes milliseconds. */
export const DURATION_MS = {
  fast: 140,
  base: 240,
  slow: 420,
} as const;

/**
 * The house curve, as cubic-bezier control points. Quick to start, settling rather than
 * bouncing: an overshoot on a KPI tile makes a business figure look like a game score.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** GSAP names its eases as strings. Same curve, different notation. */
export const GSAP_EASE_OUT = `cubic-bezier(${EASE_OUT.join(',')})`;

/*
 * Anime.js takes the curve as a *function*, not a string.
 *
 * `ease: 'cubicBezier(0.22, 1, 0.36, 1)'` was removed from the core in v4.5 — it still
 * runs, but it warns on every single tween, which buries real messages in the dev server
 * output. There is deliberately no `ANIME_EASE_OUT` constant here to replace it: building
 * one would mean importing `animejs` into this module, and this module is also imported
 * by the Framer Motion and GSAP components, which would then pull the whole Anime.js
 * runtime into their bundles for a curve they never use.
 *
 * So Anime.js call sites import `cubicBezier` themselves — they already import from
 * `animejs` — and spread the control points from `EASE_OUT` above:
 *
 *     import { animate, cubicBezier } from 'animejs';
 *     import { EASE_OUT } from '@/lib/motion';
 *
 *     animate(target, { ease: cubicBezier(...EASE_OUT) });
 *
 * One source of truth for the curve, no runtime in the wrong bundle.
 */

/**
 * How far an element travels when it enters. Deliberately small — a card that flies in
 * from 40px away draws attention to the animation rather than to the card.
 */
export const ENTER_OFFSET = 8;

/** Seconds between successive items in a staggered list. */
export const STAGGER = 0.045;

/**
 * Does this reader want less movement?
 *
 * CSS honours `prefers-reduced-motion` through the media query in tokens.css, but a
 * JavaScript engine sets inline styles and will happily animate straight past it. Every
 * animation path in this codebase checks here first, which is what makes the preference
 * actually hold.
 *
 * Returns false during server rendering, where there is no reader to ask and no
 * animation to run.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A duration that collapses to zero for a reader who asked for less movement.
 *
 * Zero rather than "skip the animation": the animation still runs and still fires its
 * completion callback, so a counter still lands on its final value and a timeline still
 * cleans up after itself. Only the movement disappears.
 */
export function motionDuration(seconds: number): number {
  return prefersReducedMotion() ? 0 : seconds;
}

export function motionDurationMs(milliseconds: number): number {
  return prefersReducedMotion() ? 0 : milliseconds;
}