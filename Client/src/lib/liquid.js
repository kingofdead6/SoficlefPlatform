/**
 * Procedural geometry for the scroll-driven liquid veil.
 *
 * Pure maths: no React, no DOM, no GSAP. Given a progress value 0→1 it returns SVG path
 * strings. The consumer builds its <path> nodes once and only ever rewrites the `d`
 * attribute, so a frame costs a few string builds and no layout.
 *
 * The veil is several layers with slightly different biases and wave shapes. Because each
 * layer lags the one behind it, the edge reads as a thick moving material rather than a
 * single rising line.
 */

/** All geometry is authored in this space and stretched by preserveAspectRatio="none". */
export const VIEW_W = 1000;
export const VIEW_H = 1000;
export const VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`;

/**
 * The layers, back to front.
 *
 * - `bias`  shifts a layer's progress so the stack doesn't move as one block. Negative
 *           lags behind the leading edge.
 * - `amp`   crest height of the surface wave, in view units.
 * - `freq`  number of crests across the width.
 * - `phase` offsets the wave so layers don't crest in the same places.
 * - `tone`  index into the palette below.
 */
export const LAYERS = [
  { id: 'veil-back', bias: -0.14, amp: 46, freq: 1.6, phase: 0.0, tone: 0 },
  { id: 'veil-mid', bias: -0.07, amp: 38, freq: 2.3, phase: 1.7, tone: 1 },
  { id: 'veil-front', bias: 0.0, amp: 30, freq: 3.1, phase: 3.4, tone: 2 },
];

/** Open arcs drawn on top of the material — the "flourishes" of the reference. */
export const FLOURISHES = [
  { at: 0.34, spread: 300, lift: 120, bias: -0.02 },
  { at: 0.68, spread: 240, lift: 92, bias: 0.03 },
];

/** Brand-derived palettes. `dark` for a light ground, `light` for a dark one. */
const PALETTES = {
  dark: ['#7f0a1d', '#a00c24', '#c8102e'],
  light: ['#f2879a', '#e11d38', '#c8102e'],
};

export function layerColor(index, palette = 'dark') {
  const set = PALETTES[palette] ?? PALETTES.dark;
  return set[LAYERS[index]?.tone ?? index] ?? set[set.length - 1];
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * A layer's own progress.
 *
 * Eased so the material accelerates in and settles at the end rather than travelling at a
 * constant rate — a linear rise reads as a wipe, not a liquid.
 */
export function layerProgress(progress, bias = 0) {
  const shifted = clamp01(progress + bias);
  // easeInOutCubic
  return shifted < 0.5
    ? 4 * shifted * shifted * shifted
    : 1 - (-2 * shifted + 2) ** 3 / 2;
}

/**
 * The filled body of one layer at a given progress.
 *
 * `flip: false` — the material rises from the bottom.
 * `flip: true`  — it descends from the top.
 *
 * The surface is sampled as a polyline rather than emitted as bezier segments: at this
 * sample count the difference is invisible, and the string is far cheaper to build every
 * frame.
 */
export function liquidPath(layer, progress, flip = false) {
  const { amp, freq, phase } = layer;

  // Wave amplitude collapses at both ends: a dead-flat start, a churning middle, and a
  // flat finish once the material has covered everything.
  const settle = Math.sin(Math.PI * clamp01(progress));
  const amplitude = amp * settle;

  // Extra height so the crests never expose the ground behind the leading edge.
  const travel = progress * (VIEW_H + amp * 2);
  const baseline = flip ? travel - amp : VIEW_H - travel + amp;

  const SAMPLES = 48;
  const points = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const x = t * VIEW_W;
    const wave =
      Math.sin(t * Math.PI * 2 * freq + phase) * amplitude +
      // A second, slower harmonic keeps the surface from looking like a pure sine.
      Math.sin(t * Math.PI * 2 * (freq * 0.37) + phase * 1.9) * amplitude * 0.35;
    points.push(`${x.toFixed(1)},${(baseline + wave).toFixed(1)}`);
  }

  const surface = points.join(' L');
  return flip
    ? `M0,0 L${surface} L${VIEW_W},0 Z`
    : `M0,${VIEW_H} L${surface} L${VIEW_W},${VIEW_H} Z`;
}

/**
 * An open arc riding just above the material's surface. Drawn (stroked), not filled, and
 * only visible while its own window of progress is open.
 */
export function flourishPath(flourish, progress, flip = false) {
  const { at, spread, lift, bias } = flourish;
  const p = clamp01(progress + bias);

  const travel = p * (VIEW_H + 80);
  const baseline = flip ? travel : VIEW_H - travel;

  const cx = at * VIEW_W;
  const x1 = cx - spread / 2;
  const x2 = cx + spread / 2;
  const y = baseline + (flip ? -lift * 0.5 : lift * 0.5);
  const cy = y + (flip ? lift : -lift);

  return `M${x1.toFixed(1)},${y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y.toFixed(1)}`;
}
