import { getTranslations } from 'next-intl/server';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import type { VisibleNavGroup } from '@/application/navigation/build-navigation';
import { loadJourney } from '@/application/onboarding/journey';
import { loadNotifications } from '@/application/notifications/inbox';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { PageTransition } from '@/components/motion/page-transition';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/i18n/config';

import { Brand } from './brand';
import { DayBadge } from './day-badge';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { SidebarNav, type NavGroupView } from './sidebar-nav';
import { TopBarTitle } from './top-bar-title';
import { UserMenu } from './user-menu';

/**
 * The application chrome: a fixed sidebar, a top bar, and a scrollable content area —
 * the prototype's structure, at its measurements (268px / 52px), rebuilt with logical
 * properties so it mirrors in Arabic.
 *
 * Below tablet width the sidebar collapses into a drawer; the content area is what
 * scrolls, so the chrome stays put on a workshop tablet.
 */
export async function AppShell({
  user,
  navigation,
  locale,
  children,
}: {
  user: AuthenticatedUser;
  navigation: VisibleNavGroup[];
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations();

  // The checklist counter reads the user's own journey. A failure here must not take the
  // whole shell down with it, so the badge degrades to absent rather than throwing.
  const needsProgress = navigation.some((group) =>
    group.items.some((item) => item.badge === 'onboarding-progress'),
  );
  const [journey, notifications] = await Promise.all([
    needsProgress ? loadJourney(user).catch(() => null) : Promise.resolve(null),
    loadNotifications(user, locale).catch(() => []),
  ]);
  const progressBadge = journey ? `${journey.progress.completed}/${journey.progress.total}` : null;

  const groups: NavGroupView[] = navigation.map((group) => ({
    id: group.id,
    items: group.items.map((item) => ({
      id: item.id,
      href: item.href,
      badge: item.badge === 'onboarding-progress' ? progressBadge : null,
    })),
  }));

  const initials = user.displayName
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  const primaryRole = user.assignments[0]?.role;
  const roleLabel = primaryRole ? t(`roles.${primaryRole}`) : '';

  return (
    <div className="flex h-dvh overflow-hidden bg-(--bg)">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-(--surface) focus:px-3 focus:py-2 focus:text-[13px]"
      >
        {t('common.skipToContent')}
      </a>

      {/* ── Sidebar (tablet and up) ─────────────────────────────────────────── */}
      <aside className="hidden w-(--sidebar-w) min-w-(--sidebar-w) flex-col border-e border-(--border) bg-(--surface) lg:flex">
        <div className="border-b border-(--border) p-4.5">
          <Brand />
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[rgba(139,105,20,0.25)] bg-(--red-dim) px-3 py-2.5">
            <span
              aria-hidden
              className="font-display flex size-8.5 shrink-0 items-center justify-center rounded-md bg-(--red-brand) text-[12px] font-bold text-white"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="text-red-strong truncate text-[11.5px] font-semibold">
                {user.displayName}
              </div>
              <div className="text-text-muted truncate text-[9.5px]">{roleLabel}</div>
            </div>
          </div>
        </div>

        <SidebarNav groups={groups} />

        <div className="text-text-dim border-t border-(--border) px-4.5 py-3 text-[9.5px]">
          {user.onboardingStartDate ? (
            <>
              {t('shell.onboardingContext')} :{' '}
              <span className="text-red-brand font-mono font-semibold">
                {formatDate(user.onboardingStartDate, locale)}
              </span>
            </>
          ) : (
            t('shell.noOnboarding')
          )}
          <div className="mt-1">{t('app.company')}</div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex h-dvh flex-1 flex-col overflow-hidden">
        <header className="flex h-(--topbar-h) min-h-(--topbar-h) items-center gap-3 border-b border-(--border) bg-(--surface) px-4 lg:px-11">
          <MobileNav groups={groups} brand={<Brand />} />
          <TopBarTitle fallback={t('app.tagline')} />
          <div className="flex-1" />
          <DayBadge startDate={user.onboardingStartDate} locale={locale} />
          <NotificationBell notifications={notifications} localePrefix={`/${locale}`} />
          <LocaleSwitcher current={locale} />
          <UserMenu displayName={user.displayName} initials={initials} roleLabel={roleLabel} />
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 py-7 lg:px-11 lg:py-9"
        >
          {/* Capped so lines stay readable on a wide desktop; the shell itself fills the
              viewport. */}
          <div className="mx-auto max-w-5xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
