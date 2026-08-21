'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

import { DURATION, EASE_OUT, ENTER_OFFSET, prefersReducedMotion } from '@/lib/motion';

/**
 * Framer Motion — page transitions.
 *
 * Framer Motion earns its place here rather than GSAP because the thing being animated
 * is a React subtree that unmounts: `AnimatePresence` keeps the outgoing page alive long
 * enough to fade, which is awkward to arrange by hand. Keyed on the pathname, so a
 * navigation is what triggers it and a re-render is not.
 *
 * The movement is 8px and 240ms. That is enough to say "this content is new" and not
 * enough to make anybody wait — CDC v0.1 §18 asks for navigation that feels instant.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduced ? false : { opacity: 0, y: ENTER_OFFSET }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -4 }}
        transition={{
          duration: reduced ? 0 : DURATION.base,
          ease: EASE_OUT,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
