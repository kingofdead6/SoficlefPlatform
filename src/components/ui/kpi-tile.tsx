import { cn } from '@/lib/cn';

/**
 * A single figure with its label. Values are monospaced: in this product, data is
 * monospaced and prose is not.
 */
export function KpiTile({
  value,
  label,
  hint,
  className,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3',
        className,
      )}
    >
      <div className="text-gold font-mono text-xl tabular-nums">{value}</div>
      <div className="text-text-muted mt-0.5 text-[11px] tracking-wide uppercase">{label}</div>
      {hint ? <div className="text-text-dim mt-1 text-[11px]">{hint}</div> : null}
    </div>
  );
}
