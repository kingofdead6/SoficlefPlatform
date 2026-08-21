import { CountUp } from '@/components/motion/count-up';
import { cn } from '@/lib/cn';

/**
 * A single figure with its label. Values are monospaced: in this product, data is
 * monospaced and prose is not.
 *
 * A plain number counts up when the tile is scrolled into view; anything else — a date,
 * a ratio like "2/12", an em dash for "not measured" — is rendered as given. The
 * distinction is made here rather than at each call site, so no page has to remember to
 * ask for the animation, and none can accidentally animate a string.
 *
 * The tile lifts very slightly on hover. Not because a KPI is interactive, but because
 * the dashboard's tiles are drill-down entry points and the movement says the surface is
 * live.
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
  const isPlainNumber = typeof value === 'number' && Number.isFinite(value);

  return (
    <div
      className={cn(
        'rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3',
        'transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-(--ease-out)',
        'hover:-translate-y-0.5 hover:border-(--red-veil) hover:shadow-(--shadow-lifted)',
        // A tile that lifts on hover must not lift when the reader asked for stillness.
        'motion-reduce:transform-none motion-reduce:transition-none',
        className,
      )}
    >
      <div className="text-red-brand font-mono text-xl tabular-nums">
        {isPlainNumber ? <CountUp value={value} /> : value}
      </div>
      <div className="text-text-muted mt-0.5 text-[11px] tracking-wide uppercase">{label}</div>
      {hint ? <div className="text-text-dim mt-1 text-[11px]">{hint}</div> : null}
    </div>
  );
}
