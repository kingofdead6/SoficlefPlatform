import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * A skein of red birds trailing the cursor.
 *
 * They fly in single file *behind* the pointer: the lead bird holds a minimum gap, each
 * one after it sits progressively further back, and the whole line carries a gentle
 * lateral wave so it never reads as a rigid tail.
 *
 * Only active inside sections marked `[data-flock]` — a flock that followed the pointer
 * across a form or a data table would be noise rather than character.
 *
 * The reference for this masked a five-frame sprite sheet. There is no sprite in this
 * project and the brief was CSS/SVG art only, so the wings are real geometry instead: two
 * paths whose control points are driven directly, which also means the birds inherit the
 * brand colour rather than needing a recoloured PNG per theme.
 */

const COUNT = 5;
const CURSOR_GAP = 75; // distance from pointer to the lead bird
const BIRD_SPACING = 48; // distance between successive birds
const FOLLOW_SPEED = 0.065;

export default function CursorFlock() {
  const root = useRef(null);
  const birds = useRef([]);
  const wings = useRef([]);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return undefined;

    const zones = Array.from(document.querySelectorAll('[data-flock]'));
    if (!zones.length) return undefined;

    let cleanup = null;

    const ctx = gsap.context(() => {
      const state = Array.from({ length: COUNT }, () => ({
        x: -200,
        y: -200,
        angle: 0,
        previousX: -200,
        previousY: -200,
      }));

      const mouse = { x: -200, y: -200 };
      const previousMouse = { x: -200, y: -200 };
      // Smoothed heading of the flock, so a jittery pointer does not whip the line around.
      const heading = { x: 1, y: 0 };
      let active = false;

      const onMove = (event) => {
        mouse.x = event.clientX;
        mouse.y = event.clientY;

        const inZone = zones.some((zone) => {
          const rect = zone.getBoundingClientRect();
          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });

        if (inZone !== active) {
          active = inZone;
          gsap.to(root.current, { opacity: inZone ? 1 : 0, duration: 0.5, ease: 'power2.out' });
        }
      };

      const tick = () => {
        const time = performance.now();

        let dirX = mouse.x - previousMouse.x;
        let dirY = mouse.y - previousMouse.y;
        const speed = Math.hypot(dirX, dirY);

        if (speed > 0.1) {
          dirX /= speed;
          dirY /= speed;
          heading.x += (dirX - heading.x) * 0.08;
          heading.y += (dirY - heading.y) * 0.08;
        }

        const headingLength = Math.hypot(heading.x, heading.y);
        if (headingLength > 0.001) {
          heading.x /= headingLength;
          heading.y /= headingLength;
        }

        // Perpendicular to the heading — the axis the lateral wave rides on.
        const perpX = -heading.y;
        const perpY = heading.x;

        for (let i = 0; i < state.length; i += 1) {
          const bird = state[i];
          const el = birds.current[i];
          if (!el) continue;

          const distance = CURSOR_GAP + i * BIRD_SPACING;
          // A different phase per bird, so the line undulates instead of swinging as one.
          const wave = Math.sin(time * 0.0015 + i * 1.7) * 8;

          const targetX = mouse.x - heading.x * distance + perpX * wave;
          const targetY = mouse.y - heading.y * distance + perpY * wave;

          // Birds further back are slightly lazier, which stretches the line on a turn.
          const ease = Math.max(0.025, FOLLOW_SPEED - i * 0.006);
          bird.x += (targetX - bird.x) * ease;
          bird.y += (targetY - bird.y) * ease;

          const moveX = bird.x - bird.previousX;
          const moveY = bird.y - bird.previousY;

          if (Math.hypot(moveX, moveY) > 0.05) {
            let angle = (Math.atan2(moveY, moveX) * 180) / Math.PI;
            // Keep the birds upright: flip rather than fly inverted when heading left.
            if (angle > 90) angle -= 180;
            if (angle < -90) angle += 180;
            bird.angle += (angle - bird.angle) * 0.1;
          }

          bird.previousX = bird.x;
          bird.previousY = bird.y;

          el.style.transform = `translate3d(${bird.x}px, ${bird.y}px, 0) rotate(${bird.angle}deg)`;
        }

        previousMouse.x = mouse.x;
        previousMouse.y = mouse.y;
      };

      gsap.ticker.add(tick);

      /*
       * Wing beat. Each bird flaps on its own slightly different period and starts out of
       * phase, so the skein never beats in unison — that synchrony is the thing that makes
       * a flock read as a decal.
       */
      wings.current.forEach((pair, index) => {
        if (!pair?.up || !pair?.down) return;

        gsap.to(
          { t: 0 },
          {
            t: 1,
            duration: 0.42 + index * 0.035,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            delay: -index * 0.13,
            onUpdate() {
              // targets() is the tweened object; read progress directly instead.
              const t = this.progress();
              // Wing tips travel from raised to lowered; the body stays put.
              const lift = -7 + t * 14;
              pair.up.setAttribute('d', `M12 8 L2 ${8 + lift} L11 11 Z`);
              pair.down.setAttribute('d', `M12 8 L22 ${8 + lift} L13 11 Z`);
            },
          },
        );
      });

      window.addEventListener('mousemove', onMove, { passive: true });

      cleanup = () => {
        gsap.ticker.remove(tick);
        window.removeEventListener('mousemove', onMove);
      };
    }, root);

    return () => {
      cleanup?.();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 z-[65] opacity-0">
      {Array.from({ length: COUNT }, (_, i) => {
        const size = 30 - i * 3; // 30, 27, 24, 21, 18
        return (
          <div
            key={`bird-${i}`}
            ref={(el) => {
              birds.current[i] = el;
            }}
            className="absolute left-0 top-0 will-change-transform"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              // Birds further back fade, which reads as distance rather than as a queue.
              opacity: 1 - i * 0.13,
              transform: 'translate3d(-200px, -200px, 0)',
            }}
          >
            <svg viewBox="0 0 24 16" className="h-full w-full" fill="var(--color-red-brand)">
              <path
                ref={(el) => {
                  wings.current[i] = { ...(wings.current[i] ?? {}), up: el };
                }}
                d="M12 8 L2 1 L11 11 Z"
              />
              <path
                ref={(el) => {
                  wings.current[i] = { ...(wings.current[i] ?? {}), down: el };
                }}
                d="M12 8 L22 1 L13 11 Z"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
