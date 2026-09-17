/**
 * The safe, drawn rather than shown.
 *
 * Every visible part is a *stroked* path with no fill, which is what makes the reveal
 * possible: a stroke can be dashed, and a dash offset animated from "one full gap" to zero
 * makes the line appear to be drawn by a pen. The reference icon in
 * `src/assets/safe-2-svgrepo-com.svg` could not be used directly — it is a single compound
 * filled path, and dashing that traces the *outline of the silhouette*, which reads as a
 * wobbling blob rather than as a drawing. So the shape is rebuilt here from strokes.
 *
 * The parts are ordered the way a hand would draw them: body, then door, then hinges, then
 * the dial, then the spokes and the handle. `data-draw` marks a path as drawable and
 * `pathLength` normalises every path to the same length regardless of its real geometry, so
 * one dash value works for all of them and the caller never has to measure anything.
 *
 * That normalised length is 100, not 1. A dash offset is a CSS length in user units, and
 * over a 0→1 range the browser rounds the sub-pixel steps away: the stroke snapped from
 * hidden to fully drawn with nothing in between, which is not a drawing. 100 gives the tween
 * real distance to travel.
 *
 * This component only declares the shape. The animation is driven by the parent's scroll
 * timeline (Takeover.jsx), which selects `[data-draw]` — keeping one timeline in charge of
 * the whole section rather than having a second one here racing it.
 */

const STROKE = '#f2879a'; // red-accent, the tone the other Takeover art uses

export default function SafeDraw({ className = '' }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      stroke={STROKE}
      /*
       * Heavier than a typical icon stroke. The flanking key and lock are drawn at ~10 units
       * on a 120-unit viewBox, and at 2.4 this sat noticeably thinner and fainter beside
       * them — it read as a different, lesser element rather than a third piece of the same
       * set. 4 holds its weight against them without closing up the dial.
       */
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* cabinet */}
      <rect data-draw pathLength="100" x="8" y="14" width="104" height="88" rx="9" />
      {/* feet, drawn as two short legs under the cabinet */}
      <path data-draw pathLength="100" d="M24 102 V110" />
      <path data-draw pathLength="100" d="M96 102 V110" />

      {/* door */}
      <rect data-draw pathLength="100" x="20" y="26" width="80" height="64" rx="5" />

      {/* hinges on the door's left edge */}
      <path data-draw pathLength="100" d="M20 40 H14" />
      <path data-draw pathLength="100" d="M20 76 H14" />

      {/* dial face */}
      <circle data-draw pathLength="100" cx="60" cy="58" r="20" />
      <circle data-draw pathLength="100" cx="60" cy="58" r="7" />

      {/* dial spokes */}
      <path data-draw pathLength="100" d="M60 38 V45" />
      <path data-draw pathLength="100" d="M60 71 V78" />
      <path data-draw pathLength="100" d="M40 58 H47" />
      <path data-draw pathLength="100" d="M73 58 H80" />

      {/* handle, on the door's right edge */}
      <path data-draw pathLength="100" d="M88 46 V70" />
      <path data-draw pathLength="100" d="M88 58 H80" />
    </svg>
  );
}
