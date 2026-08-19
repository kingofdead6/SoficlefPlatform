'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { markNotificationsRead } from '@/app/actions/notifications';
import { cn } from '@/lib/cn';

export interface NotificationView {
  id: string;
  titleFr: string;
  bodyFr: string | null;
  href: string | null;
  createdLabel: string;
  read: boolean;
}

/**
 * The in-app notification centre (CDC v0.1 §9 — in-app is mandatory, e-mail deferred).
 *
 * The unread count is announced politely rather than shouted, so a notification arriving
 * mid-task does not interrupt a screen-reader user.
 */
export function NotificationBell({
  notifications,
  localePrefix,
}: {
  notifications: NotificationView[];
  localePrefix: string;
}) {
  const t = useTranslations('notifications');
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();

  const unread = items.filter((item) => !item.read).length;

  function markRead(id?: string) {
    setItems((current) =>
      current.map((item) => (!id || item.id === id ? { ...item, read: true } : item)),
    );
    startTransition(async () => {
      const formData = new FormData();
      if (id) formData.set('id', id);
      await markNotificationsRead(null, formData);
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('open')}
        className="text-text-muted hover:text-text relative rounded border border-(--border) bg-(--surface) px-2 py-1"
      >
        <span aria-hidden className="text-[13px]">
          ✉
        </span>
        {unread > 0 ? (
          <span className="absolute -end-1.5 -top-1.5 min-w-4 rounded-full bg-(--red) px-1 text-[10px] leading-4 font-semibold text-white">
            {unread}
          </span>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {t('unreadCount', { count: unread })}
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-(--radius) border border-(--border) bg-(--surface) p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-text text-[12px] font-semibold">{t('title')}</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markRead()}
                className="text-gold-strong rounded px-1 text-[11px]"
              >
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="text-text-dim px-2 py-4 text-center text-[12px]">{t('empty')}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href ? `${localePrefix}${item.href}` : undefined}
                    onClick={() => markRead(item.id)}
                    className={cn(
                      'block rounded px-2 py-2 hover:bg-(--surface2)',
                      !item.read && 'bg-(--gold-dim)',
                    )}
                  >
                    <span className="text-text block text-[12px] font-medium">
                      {!item.read ? <span aria-hidden>• </span> : null}
                      {item.titleFr}
                    </span>
                    {item.bodyFr ? (
                      <span className="text-text-muted mt-0.5 block text-[11px]">
                        {item.bodyFr}
                      </span>
                    ) : null}
                    <span className="text-text-dim mt-0.5 block font-mono text-[10px]">
                      {item.createdLabel}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
