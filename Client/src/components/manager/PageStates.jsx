import { motion } from 'framer-motion';

/** Shared loading skeleton line — small pulse, respects prefers-reduced-motion via CSS. */
export function PageLoading({ label = 'Chargement…' }) {
  return (
    <div className="flex items-center gap-3 p-8 text-text-dim">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function PageError({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="m-6 rounded-app border border-status-red/30 bg-status-red/5 p-4 text-sm text-status-red"
    >
      {message}
    </motion.div>
  );
}

/**
 * Calm, intentional empty state — used for "no data" lists and, styled slightly
 * differently via `muted`, for the assistant's honest "not available" notices so they
 * read as deliberate rather than broken.
 */
export function EmptyState({ title, detail, muted = false }) {
  return (
    <div
      className={`rounded-app border p-4 text-sm ${
        muted ? 'border-dashed border-border bg-surface-2/60 text-text-dim' : 'border-border bg-surface text-text-dim shadow-app'
      }`}
    >
      {title && <p className="font-medium text-text-muted">{title}</p>}
      {detail && <p className={title ? 'mt-1' : ''}>{detail}</p>}
    </div>
  );
}
