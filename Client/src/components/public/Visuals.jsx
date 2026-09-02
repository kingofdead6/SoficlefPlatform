import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

/**
 * The public site's artwork, generated rather than photographed.
 *
 * Every visual here is CSS or inline SVG built from the brand tokens, so the marketing
 * pages ship complete with no external asset to fetch, no broken-image state, and nothing
 * to regenerate when the palette changes. The subject matter is the company's own world —
 * locks, keys, machined parts, the org tree — rather than generic decoration.
 *
 * All of it respects prefers-reduced-motion: animation is an enhancement on top of a
 * composition that already reads when still.
 */

/** Brand-tinted mesh, used behind hero sections. Pure CSS, no paint cost worth measuring. */
export function MeshBackdrop({ className = '' }) {
  const reduce = useReducedMotion();

  /*
   * The two blobs drift on their own slow, mismatched cycles (23s and 31s). Because the
   * periods share no common factor the pair never returns to the same arrangement, so the
   * backdrop reads as weather rather than a loop.
   *
   * Only transform and opacity are animated — both compositor properties, so a permanently
   * running background costs no layout or paint.
   */
  const drift = (x, y, scale, duration, delay = 0) =>
    reduce
      ? undefined
      : {
          animate: { x, y, scale },
          transition: {
            duration,
            delay,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          },
        };

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <motion.div
        {...drift([0, 60, 0], [0, 40, 0], [1, 1.14, 1], 23)}
        className="absolute -left-[10%] -top-[40%] h-[70%] w-[55%] rounded-full opacity-[0.28] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-red-brand), transparent 70%)' }}
      />
      <motion.div
        {...drift([0, -70, 0], [0, 50, 0], [1, 1.2, 1], 31, 1.5)}
        className="absolute -right-[5%] top-[10%] h-[60%] w-[45%] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-red-deep), transparent 70%)' }}
      />

      {/*
        The grid breathes rather than drifting: moving it sideways would make the whole
        page feel like it were sliding. Only the mask travels, so the lit area wanders
        while the grid itself stays locked to the layout.
      */}
      <motion.div
        animate={
          reduce
            ? undefined
            : {
                maskPosition: ['50% 40%', '58% 50%', '42% 34%', '50% 40%'],
                WebkitMaskPosition: ['50% 40%', '58% 50%', '42% 34%', '50% 40%'],
              }
        }
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          /*
             The gradient is centred at `50% 50%` of its own box rather than `at 50% 40%`:
             an explicit position inside the gradient would pin the lit area regardless of
             maskPosition, so the animation above would do nothing. And no-repeat is
             required — a repeating mask tiles, and a tiled mask cannot appear to travel.
          */
          maskImage: 'radial-gradient(ellipse 40% 34% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 40% 34% at 50% 50%, black, transparent)',
          maskSize: '180% 180%',
          WebkitMaskSize: '180% 180%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

/**
 * A slow aurora: three wide colour bands sweeping across each other behind content.
 *
 * Distinct from MeshBackdrop — that one is contained blobs over a grid, this is edge to
 * edge and has no structure, so the two never read as the same treatment reused. Meant for
 * bands that already carry their own surface (the vision quote, the closing CTA).
 */
export function AuroraBackdrop({ className = '', opacity = 0.5 }) {
  const reduce = useReducedMotion();

  const bands = [
    {
      image:
        'linear-gradient(115deg, transparent 20%, var(--color-red-brand) 45%, transparent 70%)',
      duration: 24,
      from: '-30% 0%',
      to: '130% 0%',
    },
    {
      image:
        'linear-gradient(70deg, transparent 25%, var(--color-red-accent) 50%, transparent 75%)',
      duration: 33,
      from: '120% 0%',
      to: '-20% 0%',
    },
    {
      image:
        'linear-gradient(160deg, transparent 30%, var(--color-red-deep) 55%, transparent 80%)',
      duration: 41,
      from: '-10% 0%',
      to: '110% 0%',
    },
  ];

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {bands.map((band, index) => (
        <motion.div
          key={band.image}
          initial={reduce ? false : { backgroundPosition: band.from }}
          animate={reduce ? undefined : { backgroundPosition: band.to }}
          transition={{
            duration: band.duration,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
          className="absolute inset-0"
          style={{
            backgroundImage: band.image,
            backgroundSize: '200% 200%',
            filter: 'blur(60px)',
            opacity: opacity * (1 - index * 0.22),
          }}
        />
      ))}
    </div>
  );
}

/**
 * The hero mark: a key turning inside a lock ring.
 *
 * The rotation is the page's one orchestrated moment — the key seats itself once on load,
 * which is the literal action the company's products perform.
 */
export function LockKeyMark({ className = '' }) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label="Serrure et clé, marque graphique de SOFICLEF"
      className={className}
    >
      <defs>
        <linearGradient id="lk-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-red-brand)" />
          <stop offset="100%" stopColor="var(--color-red-deep)" />
        </linearGradient>
      </defs>

      {/* Concentric guide rings — the machined look, drawn not photographed. */}
      {[110, 92, 74].map((r, index) => (
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

      <motion.g
        initial={reduce ? false : { rotate: -28, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{ transformOrigin: '120px 120px' }}
      >
        {/* Key bow */}
        <circle cx="120" cy="78" r="26" fill="none" stroke="url(#lk-ring)" strokeWidth="9" />
        {/* Shaft */}
        <rect x="115.5" y="102" width="9" height="74" rx="2" fill="url(#lk-ring)" />
        {/* Bit */}
        <rect x="124" y="150" width="20" height="9" rx="2" fill="url(#lk-ring)" />
        <rect x="124" y="166" width="14" height="9" rx="2" fill="url(#lk-ring)" />
      </motion.g>

      <circle cx="120" cy="120" r="130" fill="none" stroke="var(--color-red-brand)" strokeWidth="0.5" opacity="0.35" />
    </svg>
  );
}

/**
 * A canvas of drifting particles connected by short lines — the "network of sites and
 * distribution" idea, rendered generatively because hand-authored SVG for this would be
 * hundreds of meaningless path coordinates.
 */
export function ParticleField({ className = '', density = 34 }) {
  const canvasRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let frame;
    let width = 0;
    let height = 0;
    const dots = [];

    const brand = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-red-brand')
      .trim() || '#c8102e';

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seed() {
      dots.length = 0;
      for (let i = 0; i < density; i += 1) {
        dots.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 1 + Math.random() * 1.6,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < dots.length; i += 1) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j += 1) {
          const b = dots[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 108) {
            ctx.globalAlpha = (1 - dist / 108) * 0.22;
            ctx.strokeStyle = brand;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 0.55;
      ctx.fillStyle = brand;
      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function step() {
      for (const dot of dots) {
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
      }
      draw();
      frame = requestAnimationFrame(step);
    }

    resize();
    seed();

    // Reduced motion still gets the composition — one static frame, no loop.
    if (reduce) {
      draw();
    } else {
      frame = requestAnimationFrame(step);
    }

    const onResize = () => {
      resize();
      seed();
      draw();
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [density, reduce]);

  return <canvas ref={canvasRef} aria-hidden className={`h-full w-full ${className}`} />;
}

/** Diagonal hatch panel — stands in for a product/workshop photo without pretending to be one. */
export function HatchPanel({ label, icon, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-app border border-border ${className}`}
      style={{
        background:
          'repeating-linear-gradient(135deg, var(--color-surface-2) 0 10px, var(--color-surface) 10px 20px)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
        {icon && <span className="text-3xl">{icon}</span>}
        {label && (
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-dim">{label}</span>
        )}
      </div>
    </div>
  );
}

/** A section eyebrow: short rule + label, used to open every band on the public pages. */
export function Eyebrow({ children }) {
  return (
    <p className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-brand">
      <span aria-hidden className="inline-block h-px w-7 bg-red-brand" />
      {children}
    </p>
  );
}

/**
 * Scroll-triggered reveal. One wrapper so every section on the site enters the same way.
 *
 * `once: true` is deliberate: content that re-animates every time it scrolls back into
 * view is distracting on a page someone is actually reading.
 */
export function Reveal({ children, delay = 0, className = '', from = 'up' }) {
  const reduce = useReducedMotion();

  const offset = {
    up: { y: 22, x: 0 },
    left: { x: -24, y: 0 },
    right: { x: 24, y: 0 },
    none: { x: 0, y: 0 },
  }[from] ?? { y: 22, x: 0 };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered reveal for a list or grid: the container schedules its children rather than
 * each child carrying its own delay, so adding an item never means renumbering the rest.
 * Wrap each child in <RevealItem>.
 */
export function RevealGroup({ children, className = '', stagger = 0.08, delay = 0.05 }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '-70px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const revealItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

export function RevealItem({ children, className = '' }) {
  return (
    <motion.div variants={revealItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Parallax drift: moves a decorative layer slower than the page as it scrolls past.
 *
 * Strictly for ornament — never wrap text in this. `distance` is the total travel in
 * pixels across the element's whole pass through the viewport.
 */
export function Parallax({ children, distance = 60, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/**
 * A rule that draws itself in as it enters view — used to open sections without adding
 * another block of text.
 */
export function DrawRule({ className = '' }) {
  const reduce = useReducedMotion();

  return (
    <motion.span
      aria-hidden
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'left' }}
      className={`block h-px w-full bg-border ${className}`}
    />
  );
}

/**
 * The reading-progress bar pinned under the public header.
 *
 * `scaleX` on a fixed element is a compositor-only property, so this stays smooth on a
 * long page where a width animation would force layout on every frame.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const reduce = useReducedMotion();

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      style={{ scaleX: width, transformOrigin: 'left' }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 bg-red-brand"
    />
  );
}
