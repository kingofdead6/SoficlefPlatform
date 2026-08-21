'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';

import { DURATION, ENTER_OFFSET, GSAP_EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * GSAP — an orchestrated entrance for a page header.
 *
 * This is the case GSAP is actually better at: several unrelated elements arriving in a
 * deliberate order with overlapping timing. Expressing "eyebrow, then heading 0.06s in,
 * then the lede, then the figures, each overlapping the last" is one timeline here and a
 * pile of nested delays in anything else.
 *
 * `gsap.context` scopes every selector to this element and gives back a single `revert()`
 * that undoes all of it — without it, a React strict-mode double-mount leaves duplicate
 * tweens fighting over the same nodes, and the inline styles GSAP writes stay behind
 * after unmount.
 *
 * Elements are marked with `data-reveal` rather than a class, so restyling a heading
 * cannot silently detach it from the animation.
 */
export function RevealTimeline({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** The wrapper must be able to be a <section> or <header>: motion is not a reason to
   *  wrap a page's landmark in a meaningless <div>. */
  as?: 'div' | 'section' | 'header';
}) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    // The elements must be visible if anything goes wrong, so the "hidden" state is set
    // by the animation itself rather than in CSS. A reader who asked for less movement,
    // or a browser where this effect never runs, sees the finished page.
    if (prefersReducedMotion()) return;

    const context = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]');
      if (targets.length === 0) return;

      gsap
        .timeline({ defaults: { ease: GSAP_EASE_OUT, duration: DURATION.slow } })
        .from(targets, {
          opacity: 0,
          y: ENTER_OFFSET,
          // Negative offset overlaps each element with the one before it, so the run
          // reads as one movement rather than a queue.
          stagger: 0.06,
          clearProps: 'transform',
        });
    }, node);

    return () => context.revert();
  }, []);

  return (
    <Tag ref={root as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
