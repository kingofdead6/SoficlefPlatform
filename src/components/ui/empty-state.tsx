import { cn } from '@/lib/cn';

/**
 * A page with no data yet.
 *
 * The copy rule: name what will live here and what unblocks it. "Le référentiel de
 * compétences sera disponible après validation de la grille par la DRH" tells a reader
 * whose decision they are waiting on; "Coming soon" tells them nothing and invites them
 * to ask again next week.
 */
export function EmptyState({
  title,
  description,
  unblockedBy,
  glyph = '◷',
  action,
  className,
}: {
  title: string;
  description: string;
  /** Optional label above the description, e.g. "Ce qui débloque cette page". */
  unblockedBy?: string;
  glyph?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-(--radius) border border-dashed border-(--border) bg-(--surface) px-6 py-12 text-center',
        className,
      )}
    >
      <div aria-hidden className="text-gold mb-3 font-mono text-2xl">
        {glyph}
      </div>
      <h2 className="font-display text-text text-lg">{title}</h2>
      {unblockedBy ? (
        <p className="text-text-dim mt-3 text-[11px] tracking-wide uppercase">{unblockedBy}</p>
      ) : null}
      <p className="text-text-muted mx-auto mt-1.5 max-w-prose text-[13px] leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
