import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import {
  FLOURISHES,
  LAYERS,
  VIEWBOX,
  flourishPath,
  layerColor,
  layerProgress,
  liquidPath,
} from '../../lib/liquid.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven liquid veil.
 *
 * Scroll is the only source of truth: every frame reads the ScrollTrigger's progress and
 * regenerates the geometry for that value. There is no autonomous timeline, so scrolling
 * back rewinds the material exactly, and stopping freezes it mid-pour.
 *
 * The SVG nodes are built once by React. Per frame the effect rewrites only the `d`
 * attribute of a handful of paths — no re-render, no node allocation, and no property
 * that would force layout.
 *
 * @param {boolean} flip        false: material rises from the bottom · true: falls from the top
 * @param {'dark'|'light'} palette
 * @param {number} z            stacking order, written inline (see note at the wrapper)
 * @param {(p:number)=>void} onProgress  receives 0→1 on every update
 */
const EPSILON = 0.0005;

export default function LiquidVeil({
  flip = false,
  palette = 'dark',
  z = 0,
  start = 'top top',
  end = 'bottom bottom',
  onProgress,
  className = '',
}) {
  const root = useRef(null);
  const pathRefs = useRef([]);
  const flourishRefs = useRef([]);

  // The parent re-creates this callback on every render; holding it in a ref keeps the
  // effect from tearing down and rebuilding the ScrollTrigger each time.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (!root.current) return undefined;

    const ctx = gsap.context(() => {
      const section = root.current.closest('section');
      if (!section) return;

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const draw = (progress) => {
        for (let i = 0; i < LAYERS.length; i += 1) {
          const path = pathRefs.current[i];
          if (!path) continue;
          path.setAttribute(
            'd',
            liquidPath(LAYERS[i], layerProgress(progress, LAYERS[i].bias), flip),
          );
        }
        for (let i = 0; i < FLOURISHES.length; i += 1) {
          const el = flourishRefs.current[i];
          if (!el) continue;
          el.setAttribute('d', flourishPath(FLOURISHES[i], progress, flip));
        }
      };

      /*
       * Reduced motion: draw the finished state and report it, so the section reads as
       * complete rather than empty. Nothing is pinned and nothing scrubs.
       */
      if (reduced) {
        draw(1);
        onProgressRef.current?.(1);
        return;
      }

      const state = { p: 0 };
      let lastDrawn = -1;

      draw(0);
      onProgressRef.current?.(0);

      const tween = gsap.to(state, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start,
          end,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          // Skip sub-pixel repeats: scrub fires far more often than the geometry changes.
          if (Math.abs(state.p - lastDrawn) < EPSILON) return;
          lastDrawn = state.p;
          draw(state.p);
          onProgressRef.current?.(state.p);
        },
      });

      // If the page loads already scrolled past this section, sync to the real position
      // instead of starting from zero.
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const trigger = tween.scrollTrigger;
        if (trigger) {
          draw(trigger.progress);
          onProgressRef.current?.(trigger.progress);
        }
      });
    }, root);

    return () => ctx.revert();
  }, [flip, start, end]);

  return (
    /*
     * z is inline rather than a Tailwind class: two utilities of equal specificity
     * (z-0 vs z-20) are resolved by their order in the stylesheet, not the order they
     * appear in the attribute — which makes a class here unreliable.
     */
    <div
      ref={root}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: z }}
    >
      <svg
        viewBox={VIEWBOX}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ display: 'block' }}
      >
        {LAYERS.map((layer, index) => (
          <path
            key={layer.id}
            ref={(el) => {
              pathRefs.current[index] = el;
            }}
            fill={layerColor(index, palette)}
            fillRule="evenodd"
            shapeRendering="geometricPrecision"
          />
        ))}

        <g
          fill="none"
          stroke={palette === 'light' ? '#7f0a1d' : '#f2879a'}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.45"
        >
          {FLOURISHES.map((flourish, index) => (
            <path
              key={`flourish-${flourish.at}`}
              ref={(el) => {
                flourishRefs.current[index] = el;
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
