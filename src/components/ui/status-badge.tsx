import { cn } from '@/lib/cn';

/**
 * A status, never carried by colour alone (ADR-030).
 *
 * The label is required by the type, so there is no colour-only variant to reach for: a
 * vacant post reads "Poste vacant" with a warning glyph, and stays legible in monochrome
 * print and to a colour-blind reader.
 */
export type StatusTone = 'neutral' | 'brand' | 'blue' | 'green' | 'red';

const TONES: Record<StatusTone, { className: string; glyph: string }> = {
  neutral: { className: 'border-(--border) bg-(--surface2) text-text-muted', glyph: '•' },
  brand: { className: 'border-(--red-brand) bg-(--red-dim) text-red-strong', glyph: '◷' },
  blue: { className: 'border-(--blue) bg-(--blue-dim) text-blue', glyph: '▣' },
  green: { className: 'border-(--green) bg-white text-green', glyph: '✓' },
  red: { className: 'border-(--red) bg-white text-red', glyph: '⚠' },
};

export function StatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  const { className: toneClass, glyph } = TONES[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        toneClass,
        className,
      )}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </span>
  );
}
