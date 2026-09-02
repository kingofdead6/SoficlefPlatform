import { motion, useReducedMotion } from 'framer-motion';

/**
 * Shared editorial header for manager pages: serif display title, dim lede paragraph,
 * optional right-aligned actions slot. Handles its own fade/rise so pages don't repeat it.
 */
export default function PageHeader({ title, subtitle, actions, eyebrow }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"
    >
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-brand">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl leading-tight text-red-deep sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-text-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </motion.div>
  );
}
