import { useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { NotificationBell } from '../notifications/NotificationBell.jsx';
import { NAV_ITEMS } from '../../lib/navigation.js';

/** The label of the deepest nav entry matching the current path, for the page title. */
function useCurrentTitle() {
  const { pathname } = useLocation();
  const match = NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.labelFr ?? null;
}

export function TopBar() {
  const { user, logout } = useAuth();
  const title = useCurrentTitle();

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center justify-between border-b border-border bg-surface/85 px-8 backdrop-blur">
      <span className="truncate text-sm font-medium text-text-muted">{title}</span>
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <NotificationBell />
          <span className="hidden text-text-muted sm:inline">{user.displayName}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-app border border-border px-2.5 py-1 text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
          >
            Déconnexion
          </button>
        </div>
      )}
    </header>
  );
}
