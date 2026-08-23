'use client';

import {
  createDrawable,
  createScope,
  createTimeline,
  cubicBezier,
  onScroll,
  stagger,
} from 'animejs';
import { useEffect, useRef } from 'react';

import { DURATION_MS, EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * The organisational structure, drawing itself.
 *
 * Connector lines are the point. `createDrawable` turns each `<path>` into something
 * that can be tweened along its own length, so the hierarchy is traced from the
 * direction générale downwards and the boxes arrive as the lines reach them — which is
 * the order somebody reads an org chart in anyway.
 *
 * The whole run is scroll-triggered rather than synced. A structure diagram that
 * assembles and disassembles as the reader nudges the scrollbar is unreadable; this one
 * plays once, forwards, when it comes into view. `repeat: false` on the observer, not a
 * ref guard, because the observer already knows whether it has fired.
 *
 * Labels are real text in the SVG rather than baked into the drawing, so they are
 * selectable, searchable, and translated by the same catalogue as everything else.
 */
export function OrgLines() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    if (prefersReducedMotion()) return;

    const scope = createScope({ root: node }).add(() => {
      createTimeline({
        defaults: { ease: cubicBezier(...EASE_OUT) },
        autoplay: onScroll({
          target: node,
          enter: { target: 'top', container: 'bottom-=60' },
          repeat: false,
        }),
      })
        .add(
          createDrawable('[data-link]'),
          { draw: ['0 0', '0 1'], duration: DURATION_MS.slow, delay: stagger(70) },
          0,
        )
        .add(
          '[data-node]',
          {
            opacity: [0, 1],
            y: [10, 0],
            duration: DURATION_MS.base,
            delay: stagger(70),
          },
          220,
        );
    });

    return () => scope.revert();
  }, []);

  const nodes = [
    { x: 130, y: 18, label: 'Direction générale' },
    { x: 20, y: 96, label: 'Production' },
    { x: 130, y: 96, label: 'Qualité' },
    { x: 240, y: 96, label: 'RH' },
    { x: 20, y: 168, label: 'Atelier' },
    { x: 130, y: 168, label: 'HSE' },
  ];

  return (
    <div ref={root}>
      <svg viewBox="0 0 360 220" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg">
        <g
          data-link-group
          stroke="var(--border)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        >
          <path data-link d="M 175 50 V 72 H 65 V 96" />
          <path data-link d="M 175 50 V 96" />
          <path data-link d="M 175 50 V 72 H 285 V 96" />
          <path data-link d="M 65 128 V 168" />
          <path data-link d="M 175 128 V 168" />
        </g>

        {nodes.map((node) => (
          <g key={node.label} data-node style={{ opacity: 0 }}>
            <rect
              x={node.x}
              y={node.y}
              width="90"
              height="32"
              rx="6"
              fill="var(--surface)"
              stroke="var(--red-veil)"
              strokeWidth="1.5"
            />
            <text
              x={node.x + 45}
              y={node.y + 20}
              textAnchor="middle"
              className="font-mono"
              fontSize="9"
              fill="var(--text-muted)"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}