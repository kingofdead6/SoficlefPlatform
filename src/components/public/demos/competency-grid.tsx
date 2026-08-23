'use client';

import { createScope, createTimeline, stagger } from 'animejs';
import { useCallback, useEffect, useRef } from 'react';

import { DURATION_MS, prefersReducedMotion } from '@/lib/motion';

const COLUMNS = 12;
const ROWS = 7;
const CELLS = COLUMNS * ROWS;

/**
 * The competency matrix, as a grid that fills from the centre outwards.
 *
 * Each cell is one competency held by one post. The wave is Anime.js grid staggering:
 * `stagger` given a `grid` and `from: 'center'` computes each cell's delay from its
 * distance to the origin, which is the one thing that would be genuinely tedious to
 * write by hand for eighty-four elements.
 *
 * The colours are the same three the assessment scale uses everywhere else in the
 * product — acquired, in progress, to develop — so somebody who later signs in and opens
 * `/competencies` meets a legend they have already seen. A landing page demo that
 * invents its own palette teaches the reader something they then have to unlearn.
 *
 * It replays on click. That is the whole interaction: no drag, no controls, nothing to
 * learn. `pointer-events` stays on the button so keyboard users get it too.
 */
export function CompetencyGrid() {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<ReturnType<typeof createScope> | null>(null);

  const play = useCallback(() => {
    if (prefersReducedMotion()) return;

    scope.current?.revert();
    const node = root.current;
    if (!node) return;

    scope.current = createScope({ root: node }).add(() => {
      const options = { grid: [COLUMNS, ROWS] as [number, number], from: 'center' as const };

      createTimeline().add(
        '[data-cell]',
        {
          scale: [0.4, 1],
          opacity: [0.15, 1],
          duration: DURATION_MS.base,
          ease: 'outQuad',
        },
        stagger(28, options),
      );
    });
  }, []);

  useEffect(() => {
    play();
    return () => scope.current?.revert();
  }, [play]);

  return (
    <div ref={root}>
      <button
        type="button"
        onClick={play}
        className="block w-full cursor-pointer"
        // The animation is decoration; the button's job is announced by its label.
        aria-label="Rejouer l'animation"
      >
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {Array.from({ length: CELLS }, (_, index) => {
            // Deterministic, so the server and client render the same grid and
            // hydration does not warn. A random fill would differ between the two.
            const level = (index * 7 + Math.floor(index / COLUMNS) * 3) % 10;
            const tone =
              level < 5 ? 'bg-(--red-brand)' : level < 8 ? 'bg-(--red-accent)' : 'bg-(--surface2)';

            return (
              <span
                key={index}
                data-cell
                className={`aspect-square rounded-[3px] ${tone}`}
                style={{ transformOrigin: 'center' }}
              />
            );
          })}
        </div>
      </button>

      <ul className="text-text-dim mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
        {[
          ['bg-(--red-brand)', 'Acquis'],
          ['bg-(--red-accent)', 'En cours'],
          ['bg-(--surface2)', 'À développer'],
        ].map(([tone, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`inline-block size-2.5 rounded-[3px] ${tone}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}