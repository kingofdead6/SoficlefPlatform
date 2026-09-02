import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx';

const DOT_SIZE = 22;

const NAV = [
  { to: '/', labelKey: 'nav.public.home', end: true },
  { to: '/entreprise', labelKey: 'nav.public.company' },
  { to: '/strategie', labelKey: 'nav.public.strategy' },
  { to: '/organigramme', labelKey: 'nav.public.orgChart' },
];

/**
 * The public navigation, as a dot that becomes a bar.
 *
 * At rest it is a 22px brand dot with a slow pulse — the whole chrome of the site is one
 * small mark, so nothing competes with the page. Clicking it springs open into a full
 * pill; clicking away, pressing Escape, or changing route closes it again.
 *
 * On first load it plays the expand/collapse once by itself. Without that the dot is a
 * mystery: a visitor has no reason to think a 22px circle is the menu. The intro is the
 * affordance, so it runs exactly once per mount and never again.
 *
 * Under prefers-reduced-motion the whole conceit is dropped — the bar renders open and
 * static, because a control that must be animated into existence is unusable without it.
 */
export default function DotNav() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState('idle'); // idle | expanding | collapsing
  const introPlayed = useRef(false);
  const pillRef = useRef(null);
  const location = useLocation();
  const reduce = useReducedMotion();

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (pillRef.current && !pillRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /*
   * The one-time intro. Timers are collected so a fast unmount cannot leave the component
   * setting state after it has gone.
   */
  useEffect(() => {
    if (reduce || introPlayed.current) return undefined;
    introPlayed.current = true;

    const timers = [];
    timers.push(
      setTimeout(() => {
        setIntro('expanding');
        timers.push(
          setTimeout(() => {
            setIntro('collapsing');
            timers.push(setTimeout(() => setIntro('idle'), 440));
          }, 900),
        );
      }, 650),
    );

    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const expanded = open || intro === 'expanding';
  const introDone = intro === 'idle';

  /* -------------------------------------------------------------- reduced motion */
  if (reduce) {
    return (
      <div className="fixed left-1/2 top-4 z-50 w-[min(94vw,720px)] -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2.5 shadow-app">
          <Brand />
          <nav className="flex flex-1 flex-wrap items-center gap-1" aria-label={t('nav.public.mainNav')}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm ${
                    isActive ? 'bg-red-brand/12 text-red-brand' : 'text-text-muted hover:text-text'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <LanguageSwitcher />
          <Link
            to="/login"
            className="shrink-0 whitespace-nowrap rounded-full bg-red-brand px-4 py-1.5 text-sm font-medium text-white"
          >
            {t('nav.public.login')}
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- geometry */
  const pillAnimate = expanded
    ? isMobile
      ? { width: 'min(92vw, 420px)', height: 'auto', borderRadius: 24 }
      : { width: 690, height: 60, borderRadius: 30 }
    : { width: DOT_SIZE, height: DOT_SIZE, borderRadius: 999 };

  const pillTransition =
    intro === 'expanding'
      ? { type: 'spring', stiffness: 255, damping: 23 }
      : intro === 'collapsing'
        ? { type: 'spring', stiffness: 340, damping: 30 }
        : { type: 'spring', stiffness: 280, damping: 28 };

  return (
    <div
      className={
        isMobile
          ? 'fixed right-4 top-4 z-50 flex flex-col items-end'
          : 'fixed left-1/2 top-5 z-50 flex -translate-x-1/2 flex-col items-center'
      }
    >
      <motion.div
        ref={pillRef}
        onClick={() => {
          if (!open && introDone) setOpen(true);
        }}
        /*
         * The collapsed dot is the site's menu button, so it has to be reachable and
         * announced as one. Expanded, it is a container and the controls inside it take
         * over — hence role/tabIndex only while collapsed.
         */
        {...(!expanded && {
          role: 'button',
          tabIndex: 0,
          'aria-label': t('nav.public.openMenu'),
          'aria-expanded': false,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (introDone) setOpen(true);
            }
          },
        })}
        className={`relative flex flex-col items-center justify-center overflow-hidden ${
          expanded ? 'cursor-default' : 'cursor-pointer'
        }`}
        /*
         * The collapsed dot cycles through the brand reds rather than sitting on one flat
         * colour — it is on screen far longer than the open bar, and a mark that never
         * changes stops being noticed. Framer keyframes the literal colours here because
         * a CSS variable cannot be interpolated between.
         */
        /*
         * Both states set backgroundColor explicitly. Framer writes the animated value
         * inline, and an inline style beats a class — so leaving the open state to a
         * Tailwind class would let the dot's last red persist across the expansion.
         *
         * Literal hex rather than var(--color-surface): Framer interpolates between
         * parsed colours, and it cannot tween from a hex to an unresolved custom
         * property. These match the tokens in index.css, where --color-surface is
         * #ffffff with no dark override on the public site.
         */
        animate={{
          ...pillAnimate,
          backgroundColor: expanded
            ? '#ffffff'
            : ['#c8102e', '#e11d38', '#7f0a1d', '#c8102e'],
        }}
        transition={{
          ...pillTransition,
          backgroundColor: expanded
            ? { duration: 0.3 }
            : { duration: 9, ease: 'easeInOut', repeat: Infinity },
        }}
        style={{
          boxShadow: expanded
            ? '0 12px 46px rgba(23,19,20,0.16), 0 0 0 1px var(--color-border)'
            : '0 0 0 5px rgba(200,16,46,0.16), 0 4px 16px rgba(200,16,46,0.32)',
        }}
      >
        {/*
          The colour that moves along the bar.

          Two gradients drifting in opposite directions at 18s and 26s — periods that do
          not divide evenly, so the tint never settles into a visible loop. They sit above
          the pill's own translucent background (z-0) and below its contents (z-10);
          putting them behind it would hide them under `background` entirely.

          Only while open: on the 22px dot the blur radius is larger than the element, so
          it would read as mud rather than movement.
        */}
        <AnimatePresence>
          {expanded && (
            <>
              <motion.span
                key="drift-a"
                aria-hidden
                initial={{ backgroundPositionX: '0%', opacity: 0 }}
                animate={{ backgroundPositionX: '200%', opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{
                  backgroundPositionX: { duration: 18, ease: 'linear', repeat: Infinity },
                  opacity: { duration: 0.45, delay: 0.2 },
                }}
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, transparent 0%, var(--color-red-brand) 18%, transparent 34%, var(--color-red-accent) 56%, transparent 74%, var(--color-red-deep) 92%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  filter: 'blur(22px)',
                }}
              />
              <motion.span
                key="drift-b"
                aria-hidden
                initial={{ backgroundPositionX: '200%', opacity: 0 }}
                animate={{ backgroundPositionX: '0%', opacity: 0.28 }}
                exit={{ opacity: 0 }}
                transition={{
                  backgroundPositionX: { duration: 26, ease: 'linear', repeat: Infinity },
                  opacity: { duration: 0.45, delay: 0.25 },
                }}
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, transparent 10%, var(--color-red-light) 40%, transparent 70%)',
                  backgroundSize: '200% 100%',
                  filter: 'blur(28px)',
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Pulse rings, only while the dot is at rest and waiting to be noticed. */}
        <AnimatePresence>
          {!expanded && introDone && (
            <>
              {[0, 0.65].map((delay) => (
                <motion.span
                  key={delay}
                  aria-hidden
                  initial={{ scale: 1, opacity: delay ? 0.28 : 0.5 }}
                  animate={{ scale: delay ? 2.9 : 3.6, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut', delay }}
                  className="pointer-events-none absolute inset-0 rounded-full bg-red-brand"
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Accent stripe under the open bar. */}
        <AnimatePresence>
          {expanded && !isMobile && (
            <motion.span
              key="stripe"
              aria-hidden
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 0.6, scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="pointer-events-none absolute bottom-0 left-[18%] z-10 h-0.5 w-[64%] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--color-red-accent), var(--color-red-brand), transparent)',
              }}
            />
          )}
        </AnimatePresence>

        {/* ------------------------------------------------------------ desktop */}
        <AnimatePresence>
          {expanded && !isMobile && (
            <motion.div
              key="desktop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.2 }}
              className="relative z-10 flex h-[60px] w-full items-center gap-0 whitespace-nowrap ps-5 pe-2"
            >
              <Brand />
              <span aria-hidden className="mx-3.5 h-5 w-px shrink-0 bg-border" />

              <nav className="flex flex-1 items-center gap-0.5" aria-label={t('nav.public.mainNav')}>
                {NAV.map((item) => (
                  <BarLink key={item.to} item={item} />
                ))}
              </nav>

              <LanguageSwitcher className="me-2" />
              <Link
                to="/login"
                className="me-1.5 shrink-0 whitespace-nowrap rounded-full bg-red-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-red-light"
              >
                {t('nav.public.login')}
              </Link>
              <CloseButton onClick={() => setOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ------------------------------------------------------------- mobile */}
        <AnimatePresence>
          {expanded && isMobile && (
            <motion.div
              key="mobile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.2 }}
              className="relative z-10 w-full p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <Brand />
                <CloseButton onClick={() => setOpen(false)} />
              </div>

              <nav className="flex flex-col gap-1" aria-label={t('nav.public.mainNav')}>
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-2xl px-3.5 py-3 text-[15px] transition-colors ${
                        isActive
                          ? 'bg-red-brand/10 font-medium text-red-brand'
                          : 'text-text-muted hover:bg-surface-2 hover:text-text'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {t(item.labelKey)}
                        <span aria-hidden className={isActive ? 'text-red-brand' : 'text-text-dim/50'}>
                          ›
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-3.5 flex items-center gap-3 border-t border-border pt-3.5">
                <LanguageSwitcher />
                <Link
                  to="/login"
                  className="block flex-1 rounded-2xl bg-red-brand py-3 text-center text-sm font-medium text-white"
                >
                  {t('nav.public.login')}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('nav.public.brandHome')}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-full bg-red-brand font-display text-xs text-white"
      >
        S
      </span>
      <span className="font-display text-[15px] leading-none text-red-deep">SOFICLEF</span>
    </Link>
  );
}

function BarLink({ item }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `rounded-full px-3 py-[7px] text-[13.5px] transition-colors ${
          isActive
            ? 'bg-red-brand/12 font-medium text-red-brand'
            : 'text-text-muted hover:bg-text/[0.05] hover:text-text'
        }`
      }
    >
      {t(item.labelKey)}
    </NavLink>
  );
}

function CloseButton({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={t('nav.public.closeMenu')}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-dim transition-colors hover:bg-status-red/10 hover:text-status-red"
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
