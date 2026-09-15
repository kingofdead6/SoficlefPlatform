import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';

import { useTranslation } from 'react-i18next';

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
  // Named `translate` rather than the usual `t`: `handleProgress` below already uses `t`
  // for its normalised progress value, and shadowing it there would be a silent trap.
  const { t: translate, i18n } = useTranslation();
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
      const keyOutline = query('[data-key-outline]');
      const keyHole = query('[data-key-hole]');
      const keyLayer = query('[data-key-layer]');
      const keyPaths = [keyOutline, keyHole].filter(Boolean);

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
       * The key is drawn by dashing each stroke to its own length and hiding it by exactly
       * that much: tweening the offset back to zero walks the dash along the path, which is
       * what reads as a pen drawing it. Measured with getTotalLength() rather than declared
       * with the `pathLength` attribute — one call per path at setup, and no dependence on
       * a normalisation some engines have been inconsistent about.
       */
      const dash = (path) => {
        if (!path) return;
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      };
      keyPaths.forEach(dash);

      if (keyLayer) gsap.set(keyLayer, { opacity: 1 });

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
        // The key is shown finished rather than half-drawn: with no scrub to complete it,
        // any other offset would freeze it as a broken shape.
        keyPaths.forEach((el) => gsap.set(el, { strokeDashoffset: 0 }));
        if (keyLayer) gsap.set(keyLayer, { opacity: 0.22 });
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

      /*
       * The key, cut across the first two thirds of the band.
       *
       * `ease: 'none'` throughout: this timeline is scrubbed, so the ease *is* the reader's
       * scrolling. Any curve here would make the pen speed up and slow down under a steady
       * scroll, which reads as a stutter rather than as intent.
       */
      if (keyOutline) {
        relay.to(keyOutline, { strokeDashoffset: 0, ease: 'none', duration: 0.48 }, 0.10);
      }
      // The bow's hole last, as the short flourish that closes the shape.
      if (keyHole) {
        relay.to(keyHole, { strokeDashoffset: 0, ease: 'none', duration: 0.06 }, 0.58);
      }
      /*
       * Then it recedes. The key is the only thing in the frame for the first half and is
       * drawn at full strength for it; once the wordmark collapses and the description takes
       * the frame at 0.66, a full-strength line through the paragraph would be competing with
       * the text rather than backing it.
       */
      if (keyLayer) {
        relay.to(keyLayer, { opacity: 0.22, ease: 'power2.out', duration: 0.1 }, 0.66);
      }

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
    /*
     * Rebuilt on a language change: the description below is re-rendered with different
     * text, and the ScrollTrigger's measurements were taken against the old copy.
     */
  }, [i18n.language]);

  return (
    <section
      ref={root}
      aria-label={translate('public.marks.takeover')}
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

        {/* ----------------------------------------------------- the key, drawn on scroll */}
        {/*
          Its own layer at z-5: above the veil it is drawn onto, below the wordmark and the
          description at z-10, so it runs behind them rather than competing with them.

          Centred, and tall enough to stand well clear of the wordmark above and below it.
          An earlier version offset it to the start side, which at desktop widths landed it
          directly behind the first letter of "soficlef." — a collision rather than a
          composition. Centred and full height it reads as the band's spine instead, with the
          wordmark crossing it.
        */}
        <div
          data-key-layer
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center"
        >
          <DrawnKey className="h-[78vh] max-h-[680px] w-auto" />
        </div>

        {/* ------------------------------------------------------------ wordmark */}
        <div
          data-title-layer
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-5 will-change-transform"
        >
          {/*
            dir="ltr" is load-bearing, not tidiness. `splitChars` replaces this text with one
            inline-block span per character so each glyph can be animated on its own, and
            inline-blocks lay out along the *document* direction — so under Arabic the
            wordmark rendered as ".felcifos", the company's name spelled backwards. The name
            is a Latin proper noun and reads left to right in every language the site speaks,
            whatever the paragraph around it does.
          */}
          <h2
            data-word
            dir="ltr"
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
            className="pointer-events-none absolute hidden origin-top will-change-transform md:start-[3vw] md:top-[30%] md:block md:w-[16vw] md:max-w-[190px]"
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
            className="pointer-events-none absolute hidden origin-top will-change-transform md:end-[3vw] md:top-[30%] md:block md:w-[14vw] md:max-w-[170px]"
          >
            <svg viewBox="0 0 120 200" className="w-full">
              <rect x="14" y="78" width="92" height="110" rx="14" fill="none" stroke="#f2879a" strokeWidth="10" />
              <path d="M36 78 V52 a24 24 0 0 1 48 0 V78" fill="none" stroke="#f2879a" strokeWidth="10" />
              <circle cx="60" cy="126" r="12" fill="#f2879a" />
              <rect x="54" y="132" width="12" height="26" rx="3" fill="#f2879a" />
            </svg>
          </figure>

          <div className="relative z-10 w-full self-start px-6 pt-48 md:ms-auto md:px-10 md:pt-[26vh] xl:px-16">
            <div className="w-full max-w-[520px] md:ms-auto md:me-[14vw]">
              <span data-rule aria-hidden className="mb-5 block h-px w-full bg-red-accent/60 md:mb-6" />
              <p
                data-sub
                className="text-start text-[19px] font-medium leading-[1.5] tracking-[-0.01em] text-surface/85 sm:text-xl md:text-2xl md:leading-[1.55]"
              >
                {translate('public.takeover.body')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The key itself, as line art in one continuous stroke.
 *
 * Two paths, and the split is what makes the drawing read correctly rather than being a
 * modelling detail: the outline is a single unbroken pen stroke — around the bow, down the
 * shank, out and back through each tooth of the bit, to the tip — so tweening one dash
 * offset draws the whole key in the order a hand would cut it. The bow's hole cannot be part
 * of that stroke without a visible jump across the shape, so it is its own path, drawn last.
 *
 * `red-deep` rather than the pale accent the flanking figures use, because the background
 * under this key is not one colour: the veil pours upward past it, so at any moment part of
 * the key is on white and part is on brand red. A tween between two colours cannot fix that —
 * the bow and the tip are over different backgrounds at the same instant — so the stroke is
 * one tone dark enough to read on the white and distinct enough to read on the red.
 *
 * Decorative, so the layer around it carries the aria-hidden.
 */
function DrawnKey({ className = '' }) {
  return (
    <svg
      viewBox="0 0 140 500"
      className={className}
      fill="none"
      stroke="#7f0a1d"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/*
        Each circle is two explicit half arcs rather than one near-360° arc, and that is a
        correctness fix, not a style preference. An arc whose endpoints nearly coincide does
        not describe one circle: two circles of the given radius pass through both points, and
        the flags choose between them. The first version wrote the bow as a single sweep back
        onto its own start, and the renderer picked the *other* candidate — putting the bow a
        full diameter below where it belonged, with the shank drawn straight through it.

        A semicircle has no such ambiguity: the chord is the diameter, so the centre can only
        be its midpoint. Two of them, both sweeping clockwise, close the circle deterministically
        and leave the pen at the bottom of the bow, where the shank carries on.
      */}
      <path
        data-key-outline
        d="M70 128 A46 46 0 0 1 70 36 A46 46 0 0 1 70 128 L70 300 L104 300 L104 328 L70 328 L70 356 L96 356 L96 384 L70 384 L70 468"
      />
      <path data-key-hole strokeWidth="6" d="M70 62 A20 20 0 0 1 70 102 A20 20 0 0 1 70 62" />
    </svg>
  );
}
