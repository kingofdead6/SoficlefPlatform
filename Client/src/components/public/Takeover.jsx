import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';

import { splitChars } from '../../lib/text.js';
import LiquidVeil from './LiquidVeil.jsx';

gsap.registerPlugin(ScrollTrigger);

/**
 * The window of veil progress during which the headline reveals itself. Outside it the
 * text timeline sits clamped at one end, so the letters are fully hidden before the pour
 * reaches them and fully settled once it passes.
 */
const REVEAL_START = 0.5;
const REVEAL_END = 0.8;

/**
 * The pinned "takeover" band on the home page.
 *
 * A tall section pins for its duration while scroll drives two things at once: the
 * procedural LiquidVeil pouring brand red over the frame, and a per-character timeline
 * revealing the wordmark. The veil owns the progress; this component only forwards it, so
 * the two can never drift apart.
 *
 * Everything is scrubbed rather than played — scrolling back rewinds it exactly.
 */
export default function Takeover() {
  const root = useRef(null);
  const textTimeline = useRef(null);

  /** Maps the veil's 0→1 onto the letters' own reveal window. */
  const handleProgress = useCallback((progress) => {
    const timeline = textTimeline.current;
    if (!timeline) return;

    const t = (progress - REVEAL_START) / (REVEAL_END - REVEAL_START);
    // anime v4: `currentTime` is the seek handle on a paused timeline.
    timeline.currentTime = timeline.duration * Math.min(1, Math.max(0, t));
  }, []);

  useEffect(() => {
    if (!root.current) return undefined;

    const ctx = gsap.context(() => {
      const query = (selector) => root.current.querySelector(selector);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const word = query('[data-word]');
      const sub = query('[data-sub]');
      const rule = query('[data-rule]');
      const titleLayer = query('[data-title-layer]');
      const descLayer = query('[data-desc-layer]');
      const leftArt = query('[data-art-left]');
      const rightArt = query('[data-art-right]');

      if (!word || !sub) return;

      const chars = splitChars(word);
      const swing = window.matchMedia('(max-width: 767px)').matches ? 22 : 36;

      /* ---------------------------------------------------------- initial state */
      gsap.set(chars, { opacity: 0, yPercent: 70, rotate: 5, transformOrigin: '50% 100%' });
      gsap.set(sub, { opacity: 0, y: 28 });
      if (rule) gsap.set(rule, { scaleX: 0, transformOrigin: '0% 50%' });
      if (titleLayer) gsap.set(titleLayer, { paddingTop: '34vh' });
      if (descLayer) gsap.set(descLayer, { opacity: 0 });
      if (leftArt) gsap.set(leftArt, { opacity: 0, rotate: -swing, transformOrigin: '50% -140%' });
      if (rightArt) gsap.set(rightArt, { opacity: 0, rotate: swing, transformOrigin: '50% -140%' });

      /*
       * Reduced motion: lay the finished composition out and stop. Nothing pins, nothing
       * scrubs — the section is a normal, readable block of content.
       */
      if (reduced) {
        gsap.set(chars, { opacity: 1, yPercent: 0, rotate: 0 });
        gsap.set(sub, { opacity: 1, y: 0 });
        if (rule) gsap.set(rule, { scaleX: 1 });
        if (titleLayer) gsap.set(titleLayer, { paddingTop: '7vh' });
        gsap.set(word, { scale: 0.32 });
        if (descLayer) gsap.set(descLayer, { opacity: 1 });
        [leftArt, rightArt].forEach((el) => el && gsap.set(el, { rotate: 0, opacity: 1 }));
        return;
      }

      /* ------------------------------------------------- the letters (anime.js) */
      const timeline = animate(chars, {
        opacity: [0, 1],
        translateY: ['70%', '0%'],
        rotate: [5, 0],
        duration: 1100,
        delay: stagger(55),
        ease: 'outExpo',
        autoplay: false,
      });
      textTimeline.current = timeline;

      /* ------------------------------------------------- the relay (GSAP scrub) */
      const relay = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        },
      });

      // The wordmark breathes while the veil climbs over it…
      relay.fromTo(word, { scale: 1, y: 0 }, { scale: 1.04, y: -18, ease: 'none', duration: 0.62 }, 0);
      // …then collapses aside to hand the frame to the description.
      relay.to(word, { scale: 0.3, y: 0, ease: 'power2.inOut', duration: 0.16 }, 0.62);

      if (titleLayer) {
        relay.to(titleLayer, { paddingTop: '7vh', ease: 'power2.inOut', duration: 0.16 }, 0.62);
      }
      if (descLayer) {
        relay.to(descLayer, { opacity: 1, duration: 0.02 }, 0.66);
      }

      [
        [leftArt, 0.66],
        [rightArt, 0.68],
      ].forEach(([el, at]) => {
        if (!el) return;
        relay.to(el, { rotate: 0, opacity: 1, ease: 'power3.out', duration: 0.22 }, at);
      });

      if (rule) relay.to(rule, { scaleX: 1, ease: 'expo.out', duration: 0.12 }, 0.72);
      relay.to(sub, { opacity: 1, y: 0, ease: 'expo.out', duration: 0.14 }, 0.76);
    }, root);

    return () => {
      ctx.revert();
      textTimeline.current = null;
    };
  }, []);

  return (
    <section
      ref={root}
      aria-label="SOFICLEF en un mot"
      /*
       * 400vh of scroll for one pinned viewport: the height is the timeline's duration.
       * Shorter and the pour is over before it registers; much longer and it drags.
       */
      className="relative h-[400vh] bg-surface"
    >
      {/* The veil paints this band red with SVG fills, which the cursor's luminance
          check cannot read — so the tone is declared rather than guessed. */}
      <div data-cursor-invert="dark" className="sticky top-0 h-screen overflow-hidden">
        <LiquidVeil onProgress={handleProgress} palette="dark" z={0} />

        {/* ------------------------------------------------------------ wordmark */}
        <div
          data-title-layer
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-5 will-change-transform"
        >
          <h2
            data-word
            className="origin-top text-center font-display text-[22vw] font-bold leading-[0.82] tracking-tight text-surface will-change-transform sm:text-[18vw]"
            style={{ textShadow: '0 2px 60px rgba(23, 19, 20, 0.35)' }}
          >
            soficlef.
          </h2>
        </div>

        {/* --------------------------------------------------------- description */}
        <div data-desc-layer className="absolute inset-0 z-10 flex items-center will-change-transform">
          {/* Flanking artwork: a key silhouette and a lock ring, swinging in on their pivots. */}
          <figure
            data-art-left
            aria-hidden
            className="pointer-events-none absolute hidden origin-top will-change-transform md:left-[3vw] md:top-[30%] md:block md:w-[16vw] md:max-w-[190px]"
          >
            <svg viewBox="0 0 120 260" className="w-full">
              <circle cx="60" cy="46" r="34" fill="none" stroke="#f2879a" strokeWidth="11" />
              <rect x="53" y="80" width="14" height="150" rx="3" fill="#f2879a" />
              <rect x="67" y="176" width="30" height="14" rx="3" fill="#f2879a" />
              <rect x="67" y="202" width="22" height="14" rx="3" fill="#f2879a" />
            </svg>
          </figure>

          <figure
            data-art-right
            aria-hidden
            className="pointer-events-none absolute hidden origin-top will-change-transform md:right-[3vw] md:top-[30%] md:block md:w-[14vw] md:max-w-[170px]"
          >
            <svg viewBox="0 0 120 200" className="w-full">
              <rect x="14" y="78" width="92" height="110" rx="14" fill="none" stroke="#f2879a" strokeWidth="10" />
              <path d="M36 78 V52 a24 24 0 0 1 48 0 V78" fill="none" stroke="#f2879a" strokeWidth="10" />
              <circle cx="60" cy="126" r="12" fill="#f2879a" />
              <rect x="54" y="132" width="12" height="26" rx="3" fill="#f2879a" />
            </svg>
          </figure>

          <div className="relative z-10 w-full self-start px-6 pt-48 md:ml-auto md:px-10 md:pt-[26vh] xl:px-16">
            <div className="w-full max-w-[520px] md:ml-auto md:mr-[14vw]">
              <span data-rule aria-hidden className="mb-5 block h-px w-full bg-red-accent/60 md:mb-6" />
              <p
                data-sub
                className="text-left text-[19px] font-medium leading-[1.5] tracking-[-0.01em] text-surface/85 sm:text-xl md:text-2xl md:leading-[1.55]"
              >
                Depuis 1994, nous concevons et fabriquons en Algérie les serrures, poignées et
                coffres qui protègent la vie et les biens — du corps de serrure à la distribution
                nationale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
