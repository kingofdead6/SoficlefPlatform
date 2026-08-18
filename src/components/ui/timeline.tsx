import { cn } from '@/lib/cn';

/**
 * A chronological list — onboarding milestones, mission journals.
 *
 * The rail sits on the inline-start edge, so it moves to the right in Arabic without a
 * single RTL-specific rule (ADR-029).
 */
export interface TimelineEntry {
  id: string;
  /** Short marker, e.g. "J+3". Monospaced, because it is data. */
  marker: string;
  title: string;
  detail?: React.ReactNode;
  /** Rendered after the title — typically a StatusBadge. */
  status?: React.ReactNode;
}

export function Timeline({
  entries,
  label,
  className,
}: {
  entries: TimelineEntry[];
  label: string;
  className?: string;
}) {
  return (
    <ol
      className={cn('relative ms-2 border-s border-(--border) ps-5', className)}
      aria-label={label}
    >
      {entries.map((entry) => (
        <li key={entry.id} className="relative pb-5 last:pb-0">
          {/* The marker sits on the rail. Tailwind has no negative logical-inset
              utility, so the offset is written as a logical property in a style object —
              which mirrors on its own, unlike `left: -26px`. */}
          <span
            aria-hidden
            className="absolute top-1.5 size-2.5 rounded-full border-2 border-(--surface) bg-(--gold)"
            style={{ insetInlineStart: '-26px' }}
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-gold font-mono text-[11px] tabular-nums">{entry.marker}</span>
            <span className="text-text text-[13px] font-medium">{entry.title}</span>
            {entry.status}
          </div>
          {entry.detail ? (
            <div className="text-text-muted mt-1 text-[12.5px] leading-relaxed">{entry.detail}</div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
