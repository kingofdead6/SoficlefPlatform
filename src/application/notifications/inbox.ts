import 'server-only';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import type { NotificationView } from '@/components/notifications/notification-bell';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { prisma } from '@/infrastructure/db/client';

/**
 * The signed-in user's notification centre (CDC v0.1 §9).
 *
 * Scoped by construction: a notification belongs to exactly one recipient, so the query
 * filters on the session's own id and there is no cross-user read to guard against.
 * Capped at 20 — the bell is a recent-activity view, not an archive.
 */
export async function loadNotifications(
  user: AuthenticatedUser,
  locale: Locale,
): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    titleFr: row.titleFr,
    bodyFr: row.bodyFr,
    href: row.href,
    createdLabel: formatDate(row.createdAt, locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    read: row.readAt !== null,
  }));
}
