import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { notificationsApi } from '../../api/notifications.js';

/** Small top-bar bell + dropdown, polling the same endpoint the full page reads. */
export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .list()
      .then(({ data }) => {
        if (!cancelled) setNotifications(data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-app border border-border px-2 py-1.5 text-text-dim transition hover:border-red-brand hover:text-red-brand"
        aria-label={t('common.notifications.title')}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="bg-red-brand absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="border-border bg-surface shadow-app rounded-app absolute right-0 z-20 mt-2 w-80 border">
          <div className="border-border border-b px-3 py-2 text-sm font-medium text-text">
            {t('common.notifications.title')}
          </div>
          {notifications.length === 0 ? (
            <p className="text-text-dim px-3 py-4 text-sm">{t('common.notifications.empty')}</p>
          ) : (
            <ul className="divide-border max-h-80 divide-y overflow-y-auto">
              {notifications.slice(0, 8).map((notification) => (
                <li key={notification.id} className={`px-3 py-2 ${notification.read ? '' : 'bg-red-brand/5'}`}>
                  <p className="text-text text-xs font-medium">{notification.titleFr}</p>
                  {notification.bodyFr && (
                    <p className="text-text-dim mt-0.5 text-xs">{notification.bodyFr}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-red-strong border-border block border-t px-3 py-2 text-center text-xs font-medium"
          >
            {t('common.notifications.seeAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
