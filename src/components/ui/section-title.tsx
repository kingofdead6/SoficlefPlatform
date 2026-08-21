import { cn } from '@/lib/cn';

/**
 * A section heading in the display face, optionally with a red-accented fragment — the
 * prototype's one flourish, used sparingly.
 */
export function SectionTitle({
  children,
  accent,
  lead,
  level = 2,
  className,
}: {
  children: React.ReactNode;
  accent?: React.ReactNode;
  lead?: React.ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className={cn('mb-5', className)}>
      <Heading className={cn('font-display text-text', level === 2 ? 'text-2xl' : 'text-lg')}>
        {children}
        {accent ? <span className="text-red-brand"> {accent}</span> : null}
      </Heading>
      {lead ? <p className="text-text-muted mt-1.5 max-w-prose text-[13.5px]">{lead}</p> : null}
    </div>
  );
}
