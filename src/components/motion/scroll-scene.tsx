'use client';

import { animate, createScope, cubicBezier, onScroll, stagger } from 'animejs';
import { useEffect, useRef } from 'react';

import { EASE_OUT, ENTER_OFFSET, prefersReducedMotion } from '@/lib/motion';

/**
 * Anime.js Scroll Observer — a section whose entrance is tied to the scroll position.
 *
 * The difference from `RevealTimeline`, which already exists: that one fires once when
 * the page loads and plays on its own clock. This one is *synchronised* — the reader's
 * scroll position drives playback, so the content assembles as they arrive and unwinds
 * if they scroll back. It is what makes a marketing page feel authored rather than
 * merely animated, and it belongs only on the public front door.
 *
 * `sync: 'inOutQuad'` rather than `sync: true`: raw linear syncing tracks the scrollbar
 * exactly, which feels mechanical and jitters on a trackpad with momentum. Easing the
 * sync smooths the coupling without breaking the link.
 *
 * The enter/leave thresholds mean the run completes well before the section reaches the
 * middle of the viewport. Content that is still assembling when the reader is trying to
 * read it is an obstacle, not an effect.
 *
 * Children opt in with `data-scene`, matching the `data-reveal` convention already used
 * by `RevealTimeline`: an attribute rather than a class, so restyling an element cannot
 * silently detach it from the animation.
 */
export function ScrollScene({
  children,
  className,
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    // The markup renders in its final state, so stillness is simply the absence of this.
    if (prefersReducedMotion()) return;

    const scope = createScope({ root: node }).add(() => {
      const targets = node.querySelectorAll('[data-scene]');
      if (targets.length === 0) return;

      animate(targets, {
        opacity: [0, 1],
        // `y` only. A horizontal offset would have to flip sign in Arabic, and an
        // effect that needs to know the writing direction is an effect that will
        // eventually be wrong in one of the three locales — ADR-029.
        y: [ENTER_OFFSET * 2, 0],
        delay: stagger(60),
        ease: cubicBezier(...EASE_OUT),
        autoplay: onScroll({
          // `target` is the element whose position is watched; `container` would be the
          // scroller, which here is the window and is correct by default.
          target: node,
          enter: { target: 'top', container: 'bottom-=80' },
          leave: { target: 'bottom', container: 'top+=120' },
          sync: 'inOutQuad',
        }),
      });
    });

    return () => scope.revert();
  }, []);

  return (
    <Tag ref={root as React.Ref<HTMLElement & HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}