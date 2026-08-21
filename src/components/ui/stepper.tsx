import { cn } from '@/lib/cn';

/**
 * Progress through a sequence of steps.
 *
 * State is carried by a label and a glyph as well as by colour (ADR-030), and the current
 * step is announced with `aria-current` rather than by appearance alone.
 */
export interface Step {
  id: string;
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

export function Stepper({
  steps,
  label,
  doneLabel,
  className,
}: {
  steps: Step[];
  label: string;
  doneLabel: string;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', className)} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <span
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px]',
              step.state === 'done' && 'text-green border-(--green)',
              step.state === 'current' &&
                'text-red-strong border-(--red-brand) bg-(--red-dim) font-medium',
              step.state === 'upcoming' && 'text-text-dim border-(--border)',
            )}
          >
            <span aria-hidden className="font-mono text-[11px]">
              {step.state === 'done' ? '✓' : index + 1}
            </span>
            {step.label}
            {step.state === 'done' ? <span className="sr-only">{doneLabel}</span> : null}
          </span>
          {index < steps.length - 1 ? (
            <span aria-hidden className="text-text-dim rtl:rotate-180">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
