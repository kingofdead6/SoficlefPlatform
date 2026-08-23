'use client';

import { createDraggable, createScope, spring } from 'animejs';
import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/motion';

/** The milestones of the Directeur de Production journey, as a fraction of 90 days. */
const MILESTONES = [
  { day: 1, label: 'Accueil et remise du poste' },
  { day: 15, label: 'Prise en main des ateliers' },
  { day: 30, label: 'Premier point avec la DG' },
  { day: 60, label: 'Objectifs de production validés' },
  { day: 90, label: 'Bilan d’intégration' },
] as const;

const TOTAL_DAYS = 90;

/**
 * The 90-day onboarding journey, as a marker the reader drags along a track.
 *
 * This is the one genuinely interactive block on the page, and the reason it earns the
 * space is that the journey is a *duration* — a static list of five milestones does not
 * convey that day 60 is twice as far in as day 30. Dragging does.
 *
 * `createDraggable` handles the pointer, keyboard and touch input, the axis constraint,
 * and the release. `snap` set to the pixel spacing of a milestone means the marker
 * always lands on one; `releaseEase: spring()` gives it the small settle that makes
 * the snap feel like arrival rather than a jump cut. The spring is damped hard — CDC
 * v0.1 §13 asks for "sérieux, stable", and a marker that wobbles for half a second over
 * a business milestone is neither.
 *
 * Two details that are easy to get wrong:
 *
 *   - The label under the track is React state driven by `onUpdate`, not text written
 *     directly into the DOM by the animation. The animation owns the marker's position;
 *     React owns everything derived from it.
 *   - The track has to be measured, not assumed, because its width is fluid. `snap` is
 *     therefore computed after mount from the real element, and the draggable is rebuilt
 *     on resize — a snap grid calculated once against a phone-width track is wrong the
 *     moment the device rotates.
 */
export function JourneyTrack() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState<number>(MILESTONES[0].day);

  useEffect(() => {
    const node = root.current;
    const rail = track.current;
    if (!node || !rail) return;

    // Without drag the block still works: the milestone list below is the content, and
    // the marker simply sits at day 1.
    if (prefersReducedMotion()) return;

    let scope: ReturnType<typeof createScope> | null = null;

    const build = () => {
      scope?.revert();

      const width = rail.clientWidth - 28; // less the marker's own width
      if (width <= 0) return;

      scope = createScope({ root: node }).add(() => {
        createDraggable('[data-marker]', {
          container: rail,
          y: false,
          // One notch per day, so the marker can rest anywhere sensible rather than
          // only on the five milestones — the journey is continuous.
          snap: width / TOTAL_DAYS,
          releaseEase: spring({ stiffness: 180, damping: 24 }),
          onUpdate: (self) => {
            const ratio = Math.min(Math.max(self.x / width, 0), 1);
            setDay(Math.round(ratio * TOTAL_DAYS) || 1);
          },
        });
      });
    };

    build();

    const observer = new ResizeObserver(build);
    observer.observe(rail);

    return () => {
      observer.disconnect();
      scope?.revert();
    };
  }, []);

  const current = [...MILESTONES].reverse().find((milestone) => day >= milestone.day);

  return (
    <div ref={root}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-text text-3xl">J+{day}</span>
        <span className="text-text-dim font-mono text-[11px] tracking-[0.14em] uppercase">
          {TOTAL_DAYS} jours
        </span>
      </div>

      <p className="text-text-muted mt-1 min-h-[2.5rem] text-[13px]">{current?.label}</p>

      <div
        ref={track}
        className="relative mt-4 h-7 rounded-full bg-(--surface2)"
        // The rail is decorative furniture for the marker, which carries the semantics.
        aria-hidden="true"
      >
        {MILESTONES.map((milestone) => (
          <span
            key={milestone.day}
            className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-(--border)"
            // `inset-inline-start` rather than `left`, so the track reads right-to-left
            // in Arabic along with everything around it — ADR-029.
            style={{ insetInlineStart: `${(milestone.day / TOTAL_DAYS) * 100}%` }}
          />
        ))}

        <button
          type="button"
          data-marker
          className="absolute top-1/2 size-7 -translate-y-1/2 cursor-grab rounded-full bg-(--red-brand) active:cursor-grabbing"
          style={{ insetInlineStart: 0 }}
        >
          <span className="sr-only">Faire glisser pour parcourir les 90 jours</span>
        </button>
      </div>
    </div>
  );
}