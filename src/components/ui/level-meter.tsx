import { cn } from '@/lib/cn';

/**
 * A proficiency level on the configurable competency scale (CDC v0.1 §7.1).
 *
 * §7.1 requires the level to be readable without relying on colour: the rungs are drawn,
 * *and* the value is written as "3/4", *and* the whole control carries a text label for
 * a screen reader. Filled and empty rungs differ in fill and in border, so the control
 * survives monochrome print and a colour-blind reader (ADR-030).
 */
export function LevelMeter({
  value,
  max,
  label,
  tone = 'brand',
  className,
}: {
  /** The attained level. Null renders the "never assessed" state rather than a zero. */
  value: number | null;
  max: number;
  /** What is being measured, for assistive technology. */
  label: string;
  tone?: 'brand' | 'red' | 'green';
  className?: string;
}) {
  const toneClass =
    tone === 'red'
      ? 'bg-(--red) border-(--red)'
      : tone === 'green'
        ? 'bg-(--green) border-(--green)'
        : 'bg-(--red-brand) border-(--red-brand)';

  if (value === null) {
    return (
      <span className={cn('text-text-dim inline-flex items-center gap-2 text-[12px]', className)}>
        <span className="flex gap-0.5" aria-hidden>
          {Array.from({ length: max }, (_, index) => (
            <span
              key={index}
              className="h-3 w-2 rounded-[2px] border border-dashed border-(--border)"
            />
          ))}
        </span>
        <span>Non évalué</span>
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="img"
      aria-label={`${label} : niveau ${value} sur ${max}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-3 w-2 rounded-[2px] border',
              index < value ? toneClass : 'border-(--border) bg-(--surface2)',
            )}
          />
        ))}
      </span>
      <span className="text-text-muted font-mono text-[11px] tabular-nums" aria-hidden>
        {value}/{max}
      </span>
    </span>
  );
}
