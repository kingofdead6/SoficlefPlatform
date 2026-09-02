import { cn } from '../../lib/cn.js';

/**
 * The one switch control for the whole app.
 *
 * It existed five times before this, in two variants that were each wrong in their own way:
 *
 *  - three copies positioned the knob with `translate-x-*` and no `left` anchor. An
 *    absolutely-positioned element with no horizontal anchor resolves to its *static*
 *    position — the button's content box — so the travel started from the wrong origin and
 *    `translate-x-5` (20px) on a 44px track with a 20px knob also landed 2px short of the
 *    right edge.
 *  - two copies anchored correctly with `left-0.5` / `left-6`, but animated a changing
 *    `left` class with Framer's `layout` prop, so the layout animation and the class change
 *    drove the same property against each other.
 *
 * Both are fixed the same way: anchor the knob at `left` and move it with a transform whose
 * distance is computed from the geometry, so the maths is stated once instead of guessed
 * per copy. Transform-only movement is also the cheap one to animate.
 *
 * Sizes keep knob and inset fixed and vary only the track, so the "on" offset is always
 * `track - knob - 2 × inset`.
 */
const SIZES = {
  // track 44px, knob 20px, inset 2px → travel 20px
  md: { track: 'h-6 w-11', knob: 'h-5 w-5', offset: 'translate-x-5' },
  // track 48px, knob 20px, inset 2px → travel 24px
  lg: { track: 'h-6 w-12', knob: 'h-5 w-5', offset: 'translate-x-6' },
};

const TONES = {
  brand: 'bg-red-brand',
  green: 'bg-status-green',
};

/**
 * @param {boolean}  checked
 * @param {(next: boolean) => void} onChange  receives the *new* value
 * @param {boolean} [disabled]
 * @param {'md'|'lg'} [size]
 * @param {'brand'|'green'} [tone]  colour of the "on" track
 * @param {string} [label]        accessible name when no visible <label> wraps the switch
 * @param {string} [id]
 */
export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  tone = 'brand',
  label,
  id,
  className,
}) {
  const geometry = SIZES[size] ?? SIZES.md;
  const onTone = TONES[tone] ?? TONES.brand;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-full border border-transparent transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-brand',
        'disabled:cursor-not-allowed disabled:opacity-60',
        geometry.track,
        checked ? onTone : 'border-border bg-surface-2',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          // Anchored left, moved by transform: one origin, one property in motion.
          'absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          geometry.knob,
          checked ? geometry.offset : 'translate-x-0',
        )}
      />
    </button>
  );
}
