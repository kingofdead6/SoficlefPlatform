'use client';

import {
  createDrawable,
  createMotionPath,
  createScope,
  createTimeline,
  cubicBezier,
  stagger,
} from 'animejs';
import { useEffect, useRef } from 'react';

import { DURATION_MS, EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * Anime.js — the public landing hero.
 *
 * A lock assembles itself: the body and shackle draw stroke by stroke, five pins drop
 * into the cylinder in sequence, and a key travels a motion path into the keyway and
 * turns. It is the one piece of theatre on this site, and it is on the anonymous front
 * door rather than anywhere inside `(app)` — CDC v0.1 §13 asks the internal tool to feel
 * "sérieux, stable, rapide", and a Directeur de Production opening his task list is not
 * the audience for a hero animation.
 *
 * Why Anime.js rather than the two other engines already in the bundle: this is a pure
 * SVG problem. `createDrawable` animates `stroke-dashoffset` without anyone computing
 * path lengths by hand, and `createMotionPath` returns the x/y/rotate tweens that carry
 * the key along the guide path. GSAP does both with plugins that are not installed, and
 * Framer Motion does neither.
 *
 * Three constraints shape the implementation:
 *
 *   - `createScope` binds every selector to this element and hands back one `revert()`.
 *     Without it a strict-mode double mount leaves two timelines fighting over the same
 *     nodes, and the inline styles survive unmount.
 *   - The finished state is what the SVG renders. The timeline animates *from* a hidden
 *     state, so a reader with `prefers-reduced-motion`, a crawler, or a browser where the
 *     effect never runs sees a complete, correct lock rather than an empty frame.
 *   - The whole thing is `aria-hidden` with the meaning carried by the heading beside it.
 *     There is no text here a screen reader needs, and describing a decorative animation
 *     to somebody who cannot see it is noise.
 *
 * No physical-direction attributes are used, so the drawing is identical in Arabic. The
 * SVG is not mirrored deliberately: a key still turns clockwise in Boumerdès.
 */
export function LockHero({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    // The SVG already shows the assembled lock. Nothing to do but leave it.
    if (prefersReducedMotion()) return;

    const scope = createScope({ root: node }).add(() => {
      const timeline = createTimeline({
        defaults: { ease: cubicBezier(...EASE_OUT) },
      });

      timeline
        // The body and shackle draw themselves, outline first.
        .add(
          createDrawable('[data-draw="frame"]'),
          {
            draw: ['0 0', '0 1'],
            duration: DURATION_MS.slow * 2,
            delay: stagger(90),
          },
          0,
        )
        // Pins drop into the cylinder. `from: 'last'` so they settle towards the keyway
        // rather than away from it.
        .add(
          '[data-pin]',
          {
            y: [-14, 0],
            opacity: [0, 1],
            duration: DURATION_MS.base,
            delay: stagger(55, { from: 'last' }),
          },
          '-=420',
        )
        // The key rides the guide path in. `createMotionPath` returns x, y and rotate
        // tweens together, so the key stays tangent to the curve instead of sliding
        // sideways along it.
        .add(
          '[data-key]',
          {
            ...createMotionPath('[data-guide]'),
            opacity: [0, 1],
            duration: DURATION_MS.slow * 2,
          },
          '-=240',
        )
        // And turns. The cylinder follows, a beat behind, so the turn reads as the key
        // driving the mechanism rather than the two moving as one shape.
        .add('[data-key]', { rotate: '+=32', duration: DURATION_MS.base }, '-=60')
        .add('[data-cylinder]', { rotate: 32, duration: DURATION_MS.base }, '<+=40');
    });

    return () => scope.revert();
  }, []);

  return (
    <div ref={root} className={className} aria-hidden="true">
      <svg
        viewBox="0 0 320 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full max-w-[320px]"
        role="presentation"
      >
        {/* The path the key follows. Never painted — it exists only as geometry for
            createMotionPath, which reads `d` and ignores styling. */}
        <path data-guide d="M 300 214 C 250 214, 214 200, 196 176" />

        <g stroke="var(--red-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Shackle */}
          <path data-draw="frame" d="M 104 104 V 74 a 56 56 0 0 1 112 0 v 30" />
          {/* Body */}
          <path
            data-draw="frame"
            d="M 76 104 h 168 a 14 14 0 0 1 14 14 v 104 a 14 14 0 0 1 -14 14 H 76 a 14 14 0 0 1 -14 -14 V 118 a 14 14 0 0 1 14 -14 z"
          />
          {/* Cylinder — rotates about its own centre, so the transform origin has to be
              stated in user units; the default is the SVG viewport corner. */}
          <g data-cylinder style={{ transformOrigin: '160px 170px' }}>
            <circle data-draw="frame" cx="160" cy="170" r="34" />
            <path data-draw="frame" d="M 160 152 v 36" strokeWidth="6" />
          </g>
        </g>

        {/* Pins, above the cylinder, dropping into it. */}
        <g fill="var(--red-accent)">
          {[128, 144, 160, 176, 192].map((x) => (
            <rect key={x} data-pin x={x - 3} y="112" width="6" height="18" rx="3" />
          ))}
        </g>

        {/* The key. Drawn pointing along +x at the origin so createMotionPath's rotation
            aligns the bit with the direction of travel. */}
        <g
          data-key
          fill="var(--red-deep)"
          style={{ transformOrigin: 'center', opacity: 0 }}
          transform="translate(300 214)"
        >
          <circle cx="14" cy="0" r="9" fill="none" stroke="var(--red-deep)" strokeWidth="3" />
          <rect x="-30" y="-2.5" width="36" height="5" rx="2" />
          <rect x="-30" y="-11" width="5" height="9" rx="1.5" />
          <rect x="-20" y="-9" width="5" height="7" rx="1.5" />
        </g>
      </svg>
    </div>
  );
}