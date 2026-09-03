import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * The key, treated as a physical object rather than a flat mark.
 *
 * It is still SVG — no WebGL, no mesh, no extra dependency. The volume comes from three
 * things working together:
 *
 *   1. a real `perspective` on the stage, so rotation foreshortens instead of skewing;
 *   2. several copies of the key silhouette stacked along Z, which gives the blade an
 *      edge you can see when it turns — this is what makes it read as thick;
 *   3. a specular sweep pinned to the top face, so the light behaves as the key moves.
 *
 * Two inputs drive it: the pointer (tilt, spring-damped so it settles rather than snaps)
 * and scroll (a slow rotation about the shaft's axis). Both are disabled under reduced
 * motion, where the key simply sits at rest.
 */

const DEPTH_LAYERS = 7; // copies stacked along Z to fake thickness
const LAYER_STEP = 1.6; // px between them

/** One flat key silhouette. Rendered several times at different Z to build the solid. */
function KeyShape({ fill, opacity = 1 }) {
  return (
    <g fill={fill} opacity={opacity}>
      {/* bow */}
      <path d="M120 44a34 34 0 1 0 0 68 34 34 0 0 0 0-68Zm0 20a14 14 0 1 1 0 28 14 14 0 0 1 0-28Z" fillRule="evenodd" />
      {/* shaft */}
      <rect x="112" y="106" width="16" height="86" rx="3" />
      {/* bit */}
      <rect x="128" y="150" width="26" height="14" rx="3" />
      <rect x="128" y="172" width="18" height="14" rx="3" />
    </g>
  );
}

export default function KeyStage({ className = '' }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const stageRef = useRef(null);

  // Pointer position, normalised to -0.5…0.5 around the stage's centre.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  // Springs so the key settles into place instead of tracking the cursor rigidly.
  const springConfig = { stiffness: 120, damping: 18, mass: 0.6 };
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [16, -16]), springConfig);
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-22, 22]), springConfig);

  // Scroll turns the key slowly about its own axis, so it keeps moving once the pointer
  // leaves — a static object in a scrolling page reads as a sticker.
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'end start'] });
  const scrollSpin = useSpring(useTransform(scrollYProgress, [0, 1], [-26, 26]), {
    stiffness: 60,
    damping: 22,
  });

  useEffect(() => {
    if (reduce) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;

    /*
     * Listening on the window rather than the stage: the key should acknowledge the
     * cursor as it approaches, not only once it is over the artwork. The values are
     * relative to the stage's own centre either way.
     */
    const onMove = (event) => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Divided by a generous radius so the tilt eases off with distance instead of
      // pinning to the extremes the moment the pointer leaves the artwork.
      const radius = Math.max(rect.width, rect.height) * 1.6;
      pointerX.set(Math.max(-0.5, Math.min(0.5, (event.clientX - cx) / radius)));
      pointerY.set(Math.max(-0.5, Math.min(0.5, (event.clientY - cy) / radius)));
    };

    const onLeave = () => {
      pointerX.set(0);
      pointerY.set(0);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [pointerX, pointerY, reduce]);

  const layers = Array.from({ length: DEPTH_LAYERS }, (_, index) => index);

  return (
    <div
      ref={stageRef}
      className={`relative ${className}`}
      style={{ perspective: 900, perspectiveOrigin: '50% 45%' }}
    >
      {/* Guide rings sit behind the key, on the stage's own plane. */}
      <svg viewBox="0 0 240 240" aria-hidden className="absolute inset-0 h-full w-full">
        {[112, 94, 76].map((r, index) => (
          <circle
            key={r}
            cx="120"
            cy="120"
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={index === 0 ? 1.5 : 1}
            strokeDasharray={index === 2 ? '4 7' : undefined}
          />
        ))}
      </svg>

      <motion.div
        role="img"
        aria-label={t('public.marks.key')}
        style={
          reduce
            ? undefined
            : {
                rotateX: tiltX,
                rotateY: tiltY,
                rotateZ: scrollSpin,
                transformStyle: 'preserve-3d',
              }
        }
        className="relative h-full w-full"
      >
        {/*
          The solid: identical silhouettes pushed back along Z. The deepest layers are
          darkest, so the stack reads as a shaded edge rather than a blur.
        */}
        {layers.map((index) => {
          const depth = (index - (DEPTH_LAYERS - 1)) * LAYER_STEP;
          const isFace = index === DEPTH_LAYERS - 1;
          return (
            <svg
              key={index}
              viewBox="0 0 240 240"
              aria-hidden
              className="absolute inset-0 h-full w-full"
              style={{ transform: `translateZ(${depth}px)`, transformStyle: 'preserve-3d' }}
            >
              {isFace ? (
                <>
                  <defs>
                    <linearGradient id="key-face" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--color-red-light)" />
                      <stop offset="55%" stopColor="var(--color-red-brand)" />
                      <stop offset="100%" stopColor="var(--color-red-deep)" />
                    </linearGradient>
                    {/* The specular sweep: a narrow bright band across the top face. */}
                    <linearGradient id="key-sheen" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="30%" stopColor="#fff" stopOpacity="0" />
                      <stop offset="50%" stopColor="#fff" stopOpacity="0.55" />
                      <stop offset="70%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <KeyShape fill="url(#key-face)" />
                  <KeyShape fill="url(#key-sheen)" />
                </>
              ) : (
                // Depth layers: progressively darker toward the back.
                <KeyShape fill="var(--color-red-deep)" opacity={0.25 + (index / DEPTH_LAYERS) * 0.5} />
              )}
            </svg>
          );
        })}
      </motion.div>
    </div>
  );
}
