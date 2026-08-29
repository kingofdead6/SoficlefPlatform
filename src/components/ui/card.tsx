import { cn } from '@/lib/cn';

/**
 * A quiet, bordered surface. The prototype's cards are not shadowed and floating; they
 * sit on the sand background and are separated by a hairline border.
 */
export function Card({
  children,
  className,
  accent,
  compact,
  as: Component = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** A start-edge accent bar, for callouts. Mirrors in RTL on its own. */
  accent?: 'brand' | 'blue' | 'green' | 'red';
  /**
   * Tighter padding, for a card carrying one or two lines.
   *
   * A list of short alerts at the default padding scrolls out of the viewport after four
   * entries, which is exactly when a queue stops being readable as one.
   */
  compact?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  const accentClass = accent
    ? {
        brand: 'border-s-4 border-s-(--red-brand)',
        blue: 'border-s-4 border-s-(--blue)',
        green: 'border-s-4 border-s-(--green)',
        red: 'border-s-4 border-s-(--red)',
      }[accent]
    : undefined;

  return (
    <Component
      className={cn(
        'rounded-(--radius) border border-(--border) bg-(--surface) shadow-(--shadow)',
        compact ? 'px-4 py-3' : 'p-5',
        accentClass,
        className,
      )}
    >
      {children}
    </Component>
  );
}

/** The small uppercase red-brand label the prototype puts at the top of a card. */
export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        'text-red-brand mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-text-muted text-[13px] leading-[1.72]', className)}>{children}</div>
  );
}
