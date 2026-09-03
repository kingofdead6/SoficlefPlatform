import { Fragment, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ScrollProgress } from '../../components/public/Visuals.jsx';
import DotNav from '../../components/public/DotNav.jsx';
import Cursor from '../../components/public/Cursor.jsx';
import CursorFlock from '../../components/public/CursorFlock.jsx';

/**
 * Shell for the anonymous marketing pages. No auth check — these routes are reachable
 * without a session.
 *
 * Navigation lives in DotNav, which floats over the page rather than sitting in this
 * layout's flow. The footer below is the only chrome this shell still owns.
 */
const NAV = [
  { to: '/entreprise', labelKey: 'nav.public.company' },
  { to: '/strategie', labelKey: 'nav.public.strategy' },
  { to: '/organigramme', labelKey: 'nav.public.orgChart' },
];

/**
 * Address-style blocks are one catalogue entry with newlines rather than several keys, so a
 * translator sees the whole block; the line breaks are rendered here.
 */
function MultilineText({ value }) {
  return value.split('\n').map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

export default function PublicLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  /*
   * A new page starts at the top rather than inheriting the previous page's scroll
   * position. `behavior: 'instant'` is explicit because html sets scroll-behavior: smooth
   * — without it, changing page would animate a long scroll back up instead of simply
   * arriving at the new page.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ScrollProgress />
      <Cursor />
      <CursorFlock />

      <DotNav />

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg text-red-deep">SOFICLEF</p>
            <p className="mt-2 text-sm text-text-dim">{t('public.footer.tagline')}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">
              {t('public.footer.discover')}
            </p>
            <ul className="space-y-1.5 text-sm">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-text-muted hover:text-red-brand">
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">
              {t('public.footer.headquarters')}
            </p>
            <p className="text-sm text-text-muted">
              <MultilineText value={t('public.footer.headquartersAddress')} />
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">
              {t('public.footer.quality')}
            </p>
            <p className="text-sm text-text-muted">
              <MultilineText value={t('public.footer.qualityDetail')} />
            </p>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-text-dim">
            {/* The year is interpolated as a string: as a number i18next would group it
                into "2 026" under the French locale. */}
            <span>{t('public.footer.rights', { year: String(new Date().getFullYear()) })}</span>
            <Link to="/login" className="hover:text-red-brand">
              {t('public.footer.employeeArea')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
