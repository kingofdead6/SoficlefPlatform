/**
 * A progress bar, from the prototype's checklist.
 *
 * `role="progressbar"` with the aria-value* triple, plus a written percentage, so the
 * figure is available to a screen reader and not only to the eye (ADR-030).
 */
export function ProgressBar({
  value,
  label,
  detail,
  className,
}: {
  /** 0–100. */
  value: number;
  label: string;
  detail?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-text-muted text-[12px]">{label}</span>
        <span className="text-gold font-mono text-[12px] tabular-nums">
          {detail ? `${detail} · ` : ''}
          {clamped}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full border border-(--border) bg-(--surface2)"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-(--gold) to-(--gold-accent)"
          style={{ inlineSize: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
