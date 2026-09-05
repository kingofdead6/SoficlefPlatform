import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useNotifications } from '../../notifications/NotificationsContext.jsx';

/** Small top-bar bell + dropdown, backed by the shared NotificationsContext (polled). */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead } = useNotifications();
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (notification) => {
    if (!notification.read) markRead(notification.id);
    setOpen(false);
    if (notification.href) navigate(notification.href);
  };

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
          <span className="bg-red-brand absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="border-border bg-surface shadow-app rounded-app absolute end-0 z-20 mt-2 w-80 border">
          <div className="border-border border-b px-3 py-2 text-sm font-medium text-text">
            {t('common.notifications.title')}
          </div>
          {notifications.length === 0 ? (
            <p className="text-text-dim px-3 py-4 text-sm">{t('common.notifications.empty')}</p>
          ) : (
            <ul className="divide-border max-h-80 divide-y overflow-y-auto">
              {notifications.slice(0, 8).map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(notification)}
                    className={`block w-full px-3 py-2 text-start transition-colors hover:bg-surface-2 ${
                      notification.read ? '' : 'bg-red-brand/5'
                    }`}
                  >
                    <p className="text-text text-xs font-medium">{notification.titleFr}</p>
                    {notification.bodyFr && (
                      <p className="text-text-dim mt-0.5 text-xs">{notification.bodyFr}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/app/notifications');
            }}
            className="text-red-strong border-border block w-full border-t px-3 py-2 text-center text-xs font-medium"
          >
            {t('common.notifications.seeAll')}
          </button>
        </div>
      )}
    </div>
  );
}
