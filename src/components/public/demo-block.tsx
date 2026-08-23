import { cn } from '@/lib/cn';

/**
 * A caption beside a live panel — the section shape the landing page repeats.
 *
 * The reason it is a shape rather than three bespoke sections: the thing being explained
 * and the thing demonstrating it should sit in a fixed relationship, so a reader who
 * understands the first block already knows how to read the third.
 *
 * `flip` alternates which side the panel falls on down the page. It is expressed as a
 * flex `order`, not as a left/right placement, so the whole layout mirrors in Arabic
 * without a second set of rules — ADR-029.
 */
export function DemoBlock({
  eyebrow,
  title,
  children,
  panel,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  panel: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className={cn(flip && 'lg:order-2')}>
        <p data-scene className="text-red-strong font-mono text-[11px] tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
        <h2 data-scene className="font-display text-text mt-2 text-2xl text-balance sm:text-3xl">
          {title}
        </h2>
        <div data-scene className="text-text-muted mt-3 text-[15px] leading-relaxed">
          {children}
        </div>
      </div>

      <div
        data-scene
        className={cn(
          'rounded-(--radius) border border-(--border) bg-(--surface) p-6',
          'shadow-(--shadow)',
          flip && 'lg:order-1',
        )}
      >
        {panel}
      </div>
    </div>
  );
}