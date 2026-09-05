import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx';

const NAV = [
  { to: '/', labelKey: 'nav.public.home', end: true },
  { to: '/entreprise', labelKey: 'nav.public.company' },
  { to: '/strategie', labelKey: 'nav.public.strategy' },
  { to: '/organigramme', labelKey: 'nav.public.orgChart' },
];

/** The public navigation: a bar fixed to the top of the page, always visible. */
export default function DotNav() {
  const { t } = useTranslation();

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(94vw,800px)] -translate-x-1/2">
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
