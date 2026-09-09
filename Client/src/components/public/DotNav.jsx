import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx';

const NAV = [
  { to: '/', labelKey: 'nav.public.home', end: true },
  { to: '/entreprise', labelKey: 'nav.public.company' },
  { to: '/strategie', labelKey: 'nav.public.strategy' },
  { to: '/organigramme', labelKey: 'nav.public.orgChart' },
];

/**
 * The public navigation: a bar fixed to the top of the page, always visible.
 *
 * Below `lg` the link list, language switcher and login button no longer fit the pill in
 * one row, so they collapse into a hamburger-triggered dropdown instead of wrapping or
 * overflowing the rounded bar.
 */
export default function DotNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // A route change already implies the menu's job is done; keep it from staying open
  // over the next page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open, so the page behind it doesn't scroll
  // along with a swipe meant for the dropdown.
  useEffect(() => {
    if (!open) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(94vw,800px)] -translate-x-1/2">
      <div className="rounded-app border border-border bg-surface shadow-app lg:rounded-full">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Brand />

          <nav
            className="hidden flex-1 flex-wrap items-center gap-1 lg:flex"
            aria-label={t('nav.public.mainNav')}
          >
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

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <LanguageSwitcher />
            <Link
              to="/login"
              className="shrink-0 whitespace-nowrap rounded-full bg-red-brand px-4 py-1.5 text-sm font-medium text-white"
            >
              {t('nav.public.login')}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={t(open ? 'nav.public.closeMenu' : 'nav.public.openMenu')}
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text lg:hidden"
          >
            <BurgerIcon open={open} />
          </button>
        </div>

        {open && (
          <div className="border-t border-border px-4 pb-4 pt-2 lg:hidden">
            <nav
              className="flex flex-col gap-1"
              aria-label={t('nav.public.mainNav')}
            >
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-app px-3 py-2 text-sm ${
                      isActive ? 'bg-red-brand/12 text-red-brand' : 'text-text-muted hover:text-text'
                    }`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <LanguageSwitcher />
              <Link
                to="/login"
                className="shrink-0 whitespace-nowrap rounded-full bg-red-brand px-4 py-1.5 text-sm font-medium text-white"
              >
                {t('nav.public.login')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

function BurgerIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}
