import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { buildNavigation, canOpen } from '@/application/navigation/build-navigation';
import { AppShell } from '@/components/shell/app-shell';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/navigation';
import { PATHNAME_HEADER } from '@/proxy';

/**
 * Everything behind this layout requires a session, and a route the user may not open is
 * refused here — before the shell renders, so the response really is a 404 rather than a
 * 200 carrying a 404 page.
 *
 * The check lives here rather than in the proxy: proxy code may be deployed to a CDN and
 * must not depend on server-side modules, so the session, which is a database row, is
 * resolved where the data is (ADR-036). Each page re-checks its own permission too —
 * defence in depth, and the page is the boundary if this layout is ever bypassed.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    // next-intl's redirect throws, but its return type does not narrow `user`, so the
    // control flow is made explicit rather than asserted away with `!`.
    redirect({ href: '/login', locale });
    return null;
  }

  /*
   * An account SI has created but HR has not yet placed has no perimeter, so there is
   * nothing behind this layout it could meaningfully be shown. It goes to `/pending`,
   * which sits outside this route group precisely so this redirect cannot loop.
   */
  if (user.lifecycleState === 'PENDING_ASSIGNMENT') {
    redirect({ href: '/pending', locale });
    return null;
  }

  // The proxy forwards the path; a layout cannot read it on its own.
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? '';
  const route = pathname.replace(new RegExp(`^/${locale}`), '') || '/';
  const item = navItemByHref(route);

  /*
   * Refuse rather than skip when the route does not resolve to a nav entry.
   *
   * This used to read `if (item && !canOpen(user, item))`, which *passed* whenever
   * `item` was undefined. Nothing exploited it — every current route resolves, and the
   * proxy matcher covers every page path so the header is always present — but it fails
   * open in two ways worth closing before they bite:
   *
   *   - `navItemByHref` is an exact-match lookup, so the first nested route
   *     (`/organization/[id]`) would resolve to nothing and skip the check entirely.
   *   - If `PATHNAME_HEADER` were ever absent, `route` becomes '/', which also resolves
   *     to nothing.
   *
   * An authenticated route that the navigation model does not know about is a mistake,
   * and the safe reading of a mistake is 404.
   */
  if (!item || !canOpen(user, item)) notFound();

  return (
    <AppShell user={user} navigation={buildNavigation(user)} locale={locale as Locale}>
      {children}
    </AppShell>
  );
}
