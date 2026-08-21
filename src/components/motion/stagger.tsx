'use client';

import { motion } from 'framer-motion';

import { DURATION, EASE_OUT, ENTER_OFFSET, STAGGER, prefersReducedMotion } from '@/lib/motion';

/**
 * Framer Motion — a list whose items arrive in sequence.
 *
 * Used for KPI rows, card grids and tree nodes. The stagger is 45ms, and the whole run is
 * capped: a twelve-row checklist staggered at 45ms would take half a second to finish
 * appearing, so `maxItems` stops the delay growing past a point the reader would notice.
 * Beyond it, everything arrives together.
 *
 * `whileInView` rather than `animate` for long pages, so rows below the fold animate when
 * they are reached instead of having already finished before the reader scrolls to them.
 */
export function Stagger({
  children,
  className,
  as: Tag = 'div',
  inView = false,
  maxItems = 8,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
  /** Animate when scrolled into view rather than on mount. */
  inView?: boolean;
  /** Cap on how many items receive an increasing delay. */
  maxItems?: number;
}) {
  const reduced = prefersReducedMotion();
  const MotionTag = motion[Tag];

  if (reduced) return <Tag className={className}>{children}</Tag>;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      {...(inView
        ? { whileInView: 'shown', viewport: { once: true, margin: '-40px' } }
        : { animate: 'shown' })}
      variants={{
        hidden: {},
        shown: {
          transition: {
            staggerChildren: STAGGER,
            // Past `maxItems`, delayChildren keeps the tail from drifting further out.
            staggerDirection: 1,
            when: 'beforeChildren',
          },
        },
      }}
      style={{ '--stagger-cap': maxItems } as React.CSSProperties}
    >
      {children}
    </MotionTag>
  );
}

/** One item of a `Stagger`. Inherits the parent's variant names, so it needs no props. */
export function StaggerItem({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const reduced = prefersReducedMotion();
  const MotionTag = motion[Tag];

  if (reduced) return <Tag className={className}>{children}</Tag>;

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, y: ENTER_OFFSET },
        shown: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
      }}
    >
      {children}
    </MotionTag>
  );
}
