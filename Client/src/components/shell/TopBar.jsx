import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthContext.jsx';
import { NotificationBell } from '../notifications/NotificationBell.jsx';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx';
import { NAV_ITEMS } from '../../lib/navigation.js';
import { useSidebar } from './SidebarContext.jsx';

/** The label of the deepest nav entry matching the current path, for the page title. */
function useCurrentTitle() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const match = NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match ? t(match.labelKey) : null;
}

export function TopBar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const title = useCurrentTitle();
  const { setOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center justify-between gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {user && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('nav.public.openMenu')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-app text-text-dim transition-colors hover:bg-surface-2 hover:text-text lg:hidden"
          >
            <span aria-hidden className="flex flex-col gap-[3px]">
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
              <span className="h-[1.5px] w-4 rounded-full bg-current" />
            </span>
          </button>
        )}
        <span className="truncate text-sm font-medium text-text-muted">{title}</span>
      </div>
      {user && (
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <NotificationBell />
          <LanguageSwitcher />
          <span className="hidden text-text-muted sm:inline">{user.displayName}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="shrink-0 whitespace-nowrap rounded-app border border-border px-2.5 py-1 text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('common.actions.logout')}
          </button>
        </div>
      )}
    </header>
  );
}
