import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notificationsApi } from '../../api/notifications.js';
import { localeOf } from '../../lib/formatDate.js';

/**
 * The notification centre (CDC v0.1 §9). Ported from
 * SoficlefPlatform's notification bell, as a full page rather than a dropdown — capped
 * at 20 rows by the API, oldest unread first, matching the source ordering.
 */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t, i18n } = useTranslation();

  const formatDate = useCallback(
    (value) =>
      new Intl.DateTimeFormat(localeOf(i18n), {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
    [i18n],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data ?? []);
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      load();
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markRead();
    } catch {
      load();
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-red-deep">{t('notifications.title')}</h1>
          <p className="text-text-dim mt-1 text-sm">
            {unreadCount > 0 ? t('notifications.unread', { count: unreadCount }) : t('notifications.allRead')}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-app border border-border px-3 py-1.5 text-sm text-text-dim transition hover:border-red-brand hover:text-red-brand"
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-text-dim text-sm">{t('common.states.loading')}</p>
      ) : error ? (
        <p className="text-sm text-red-brand">{t('notifications.loadFailed')}</p>
      ) : notifications.length === 0 ? (
        <p className="text-text-dim text-sm">{t('notifications.empty')}</p>
      ) : (
        <ul className="divide-border divide-y rounded-app border border-border bg-surface">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`flex items-start justify-between gap-4 px-4 py-3 ${
                notification.read ? '' : 'bg-red-brand/5'
              }`}
            >
              <div className="min-w-0">
                <p className="text-text text-sm font-medium">{notification.titleFr}</p>
                {notification.bodyFr && (
                  <p className="text-text-dim mt-0.5 text-sm">{notification.bodyFr}</p>
                )}
                <p className="text-text-muted mt-1 text-xs">{formatDate(notification.createdAt)}</p>
                {notification.href && (
                  <a href={notification.href} className="text-red-strong mt-1 inline-block text-xs font-medium">
                    {t('notifications.open')}
                  </a>
                )}
              </div>
              {!notification.read && (
                <button
                  type="button"
                  onClick={() => markRead(notification.id)}
                  className="shrink-0 rounded-app border border-border px-2 py-1 text-xs text-text-dim transition hover:border-red-brand hover:text-red-brand"
                >
                  {t('notifications.markRead')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
