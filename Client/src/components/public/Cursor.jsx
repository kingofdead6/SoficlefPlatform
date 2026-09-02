import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

/**
 * The custom cursor: a small disc that grows over anything marked `data-cursor`, and
 * shows a label from `data-cursor-text`.
 *
 * The disc inverts against whatever it is actually over — dark ink on light ground, light
 * on dark. The tone is read from the painted background under the pointer rather than
 * from a hardcoded list of sections: this site has grounds that change at very different
 * depths (a whole section for the takeover band, a single card elsewhere), and a selector
 * list would fall out of step the first time a section moved.
 *
 * Disabled on touch and under reduced motion, where the native cursor is left alone.
 */

const INK_ON_LIGHT = '#7f0a1d'; // red-deep
const INK_ON_DARK = '#ffffff';
const ACCENT_ON_LIGHT = '#c8102e'; // red-brand
const ACCENT_ON_DARK = '#f2879a'; // red-accent

/**
 * Perceived luminance of a CSS `rgb()`/`rgba()` string. Returns null when the colour is
 * missing or effectively transparent, which is the signal to keep walking up the tree.
 */
function luminanceOf(color) {
  if (!color) return null;

  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;

  const [r, g, b] = parts.map(Number);
  const alpha = parts.length > 3 ? Number(parts[3]) : 1;

  // A transparent background paints nothing, so it cannot decide the tone.
  if (alpha < 0.5) return null;

  // ITU-R BT.601 weighting: close enough to the eye for a light/dark test, without the
  // cost of a full sRGB linearisation on every pointer move.
  return (r * 299 + g * 587 + b * 114) / 255000;
}

/**
 * Walks up from the hovered element until it finds a genuinely opaque background, and
 * reports whether it is dark.
 *
 * The parent chain matters: most elements (headings, links, spans) have no background of
 * their own and return `rgba(0,0,0,0)` — it is a container above them that paints.
 */
function isOnDarkBackdrop(startEl) {
  let node = startEl;

  while (node && node !== document.documentElement) {
    if (node.nodeType === 1) {
      /*
       * `data-cursor-invert` forces the answer. It covers grounds the calculation cannot
       * see: a background image, a gradient, an SVG fill — the takeover band's liquid
       * veil among them. Better an explicit override than a wrong guess.
       */
      const forced = node.getAttribute?.('data-cursor-invert');
      if (forced === 'dark') return true;
      if (forced === 'light') return false;

      const lum = luminanceOf(getComputedStyle(node).backgroundColor);
      if (lum !== null) return lum < 0.5;
    }
    node = node.parentElement;
  }

  // Nothing opaque found: the page ground is near-white, so light.
  return false;
}

export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const [label, setLabel] = useState('');
  /*
   * The label is painted on top of the disc, so its colour must be the disc's opposite.
   * This is the only piece of inversion state that has to reach React at all.
   */
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return undefined;

    document.body.classList.add('has-cursor');

    // quickTo keeps a single tween alive per axis instead of allocating one per move.
    const xTo = gsap.quickTo(dot.current, 'x', { duration: 0.32, ease: 'power3' });
    const yTo = gsap.quickTo(dot.current, 'y', { duration: 0.32, ease: 'power3' });
    // The ring trails further behind, which is what gives the pair its weight.
    const ringX = gsap.quickTo(ring.current, 'x', { duration: 0.7, ease: 'power3' });
    const ringY = gsap.quickTo(ring.current, 'y', { duration: 0.7, ease: 'power3' });

    /*
     * Held outside React: both change on every pointer move but only ever choose a
     * colour, so routing them through state would re-render on every frame.
     */
    let onDark = false;
    let hovering = false;

    const paint = () => {
      const accent = onDark ? ACCENT_ON_DARK : ACCENT_ON_LIGHT;
      const ink = onDark ? INK_ON_DARK : INK_ON_LIGHT;
      gsap.to(dot.current, {
        backgroundColor: hovering ? accent : ink,
        duration: 0.35,
        ease: 'power3.out',
      });
      gsap.to(ring.current, {
        borderColor: hovering ? accent : ink,
        duration: 0.35,
        ease: 'power3.out',
      });
    };

    const onMove = (event) => {
      xTo(event.clientX);
      yTo(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);

      /*
       * elementFromPoint rather than event.target: the cursor is fixed, and several
       * sections lay a full-bleed overlay over their content — event.target would report
       * that overlay, whose gradient background is invisible to backgroundColor. The disc
       * itself is pointer-events:none, so it cannot detect itself.
       */
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const next = under ? isOnDarkBackdrop(under) : false;

      if (next !== onDark) {
        onDark = next;
        // Re-renders only when the ground actually changes — a handful of times per
        // page, not once per frame.
        setDark(next);
        paint();
      }
    };

    const onOver = (event) => {
      const target = event.target.closest?.('[data-cursor]');
      if (!target) return;
      const text = target.getAttribute('data-cursor-text') || '';
      setLabel(text);
      hovering = true;
      gsap.to(dot.current, { scale: text ? 3.4 : 2.2, duration: 0.4, ease: 'power3.out' });
      gsap.to(ring.current, { scale: 1.6, opacity: 0.35, duration: 0.4, ease: 'power3.out' });
      paint();
    };

    const onOut = (event) => {
      if (!event.target.closest?.('[data-cursor]')) return;
      setLabel('');
      hovering = false;
      gsap.to(dot.current, { scale: 1, duration: 0.4, ease: 'power3.out' });
      gsap.to(ring.current, { scale: 1, opacity: 0.6, duration: 0.4, ease: 'power3.out' });
      paint();
    };

    // Hide the pair when the pointer leaves the window, so it does not sit frozen at the
    // last known position.
    const onLeave = () => {
      gsap.to([dot.current, ring.current], { opacity: 0, duration: 0.25 });
    };
    const onEnter = () => {
      gsap.to(dot.current, { opacity: 1, duration: 0.25 });
      gsap.to(ring.current, { opacity: 0.6, duration: 0.25 });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      document.body.classList.remove('has-cursor');
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[70] hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border md:block"
        style={{ borderColor: INK_ON_LIGHT, opacity: 0.6 }}
      />
      <div
        ref={dot}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[71] hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full md:flex"
        style={{ backgroundColor: INK_ON_LIGHT }}
      >
        {label && (
          <span
            className={`whitespace-nowrap font-mono text-[3.2px] uppercase tracking-[0.14em] ${
              dark ? 'text-text' : 'text-surface'
            }`}
          >
            {label}
          </span>
        )}
      </div>
    </>
  );
}
