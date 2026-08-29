import { CountUp } from '@/components/motion/count-up';
import { Link } from '@/i18n/navigation';
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
  href,
  className,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  /**
   * Where the figure leads, when it stands for something the reader can act on.
   *
   * A count of things to do that cannot be clicked makes the reader hunt the sidebar for
   * the screen it refers to. Omit it for a figure that is only a measurement — a
   * satisfaction score leads nowhere in particular, and a false affordance is worse than
   * none.
   */
  href?: string;
  className?: string;
}) {
  const isPlainNumber = typeof value === 'number' && Number.isFinite(value);

  const classes = cn(
    'rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3',
    'transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-(--ease-out)',
    // A tile that lifts on hover promises interactivity; only a linked one keeps it.
    href
      ? 'block hover:-translate-y-0.5 hover:border-(--red-brand) hover:shadow-(--shadow-lifted)'
      : 'hover:border-(--red-veil)',
    // A tile that lifts must not lift when the reader asked for stillness.
    'motion-reduce:transform-none motion-reduce:transition-none',
    className,
  );

  const content = (
    <>
      {/*
        * A zero is not an alarm. "0 en retard" is the good outcome, and rendering it in the
        * same brand red as "12 évaluations à faire" makes a dashboard where nothing is
        * wrong look identical to one where everything is. Zero recedes; anything else keeps
        * the brand colour.
        */}
      <div
        className={cn(
          'font-mono text-xl tabular-nums',
          isPlainNumber && value === 0 ? 'text-text-dim' : 'text-red-brand',
        )}
      >
        {isPlainNumber ? <CountUp value={value} /> : value}
      </div>
      <div className="text-text-muted mt-0.5 text-[11px] tracking-wide uppercase">{label}</div>
      {hint ? <div className="text-text-dim mt-1 text-[11px]">{hint}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
