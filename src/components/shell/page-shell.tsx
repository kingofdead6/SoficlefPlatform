import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { canOpen } from '@/application/navigation/build-navigation';
import { EmptyState } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * A route that has no content module yet.
 *
 * Three things happen here, and the third is the important one:
 *  1. the page names itself and says what will live on it;
 *  2. it says what unblocks it, in the client's own terms;
 *  3. it re-checks the permission for this route — the sidebar hiding a link is a
 *     courtesy, this is the boundary (ADR-020, ADR-031).
 */
export async function ModulePlaceholder({ href }: { href: string }) {
  const item = navItemByHref(href);
  if (!item) notFound();

  const user = await getCurrentUser();
  if (!user || !canOpen(user, item)) notFound();

  const t = await getTranslations();

  // The top bar already names the page; repeating it as a section heading and again
  // inside the empty state would say the same word three times.
  return <EmptyState title={t(`nav.items.${item.id}`)} description={t(`empty.${item.id}`)} />;
}
