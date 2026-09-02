/**
 * Shared Framer Motion variants/transitions for the manager portal.
 * Keep these generic (page shells, list stagger, card hover) so all 11 pages compose
 * the same motion language instead of re-declaring bespoke easing curves.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1];

/** initial prop helper: pass the value from useReducedMotion() to skip the "hidden" state entirely. */
export function initialOrNone(reduce, hiddenKey = 'hidden') {
  return reduce ? false : hiddenKey;
}

/** Page-level fade + rise, used once per page as the outermost motion.div. */
export const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

/** Stagger container for lists/grids of cards or rows. */
export function staggerContainer(stagger = 0.06, delayChildren = 0.05) {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Individual item entrance inside a staggerContainer. */
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
};

/** Slightly larger-travel variant for section blocks (dashboard panels, doc sections). */
export const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

/** Hover/tap micro-interaction for clickable cards. */
export const cardHover = {
  rest: { y: 0, boxShadow: '0 1px 4px rgba(23, 19, 20, 0.07)' },
  hover: {
    y: -3,
    boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)',
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  tap: { y: -1, transition: { duration: 0.1 } },
};

/** Row entrance for table bodies. */
export const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

/** Fade used with AnimatePresence for alerts/panels that mount/unmount. */
export const fadeInOut = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.3, ease: EASE_OUT },
};
