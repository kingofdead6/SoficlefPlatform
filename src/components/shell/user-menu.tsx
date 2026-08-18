'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The signed-in user's menu. Sign-out revokes the session server-side (Part 3), then the
 * router refreshes so the shell re-renders as anonymous.
 */
export function UserMenu({
  displayName,
  initials,
  roleLabel,
}: {
  displayName: string;
  initials: string;
  roleLabel: string;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': document.cookie.match(/soficlef_csrf=([^;]+)/)?.[1] ?? '',
        },
      });
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu.Root>
      {/* WCAG 2.5.3, Label in Name: the accessible name must contain whatever is visible
          on the button. That differs by viewport — the full name on desktop, the initials
          alone on a narrow screen — so both are in the label. */}
      <DropdownMenu.Trigger
        aria-label={`${initials} · ${displayName} · ${t('userMenu')}`}
        className="text-text-muted hover:text-text flex items-center gap-2 rounded-md border border-(--border) px-2 py-1 text-[12px] hover:bg-(--surface2)"
      >
        <span
          aria-hidden
          className="font-display flex size-6 items-center justify-center rounded bg-(--gold) text-[10px] font-bold text-white"
        >
          {initials}
        </span>
        <span className="hidden max-w-[12rem] truncate sm:inline">{displayName}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="min-w-56 rounded-(--radius) border border-(--border) bg-(--surface) p-1.5 shadow-(--shadow)"
        >
          <DropdownMenu.Label className="px-2 py-1.5">
            <span className="text-text-dim block text-[10px] tracking-wide uppercase">
              {t('signedInAs')}
            </span>
            <span className="text-text block truncate text-[12.5px] font-medium">
              {displayName}
            </span>
            <span className="text-text-muted block truncate text-[11px]">{roleLabel}</span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="my-1 h-px bg-(--border)" />

          <DropdownMenu.Item
            onSelect={() => void signOut()}
            disabled={isSigningOut}
            className="text-text-muted data-[highlighted]:text-text cursor-pointer rounded px-2 py-1.5 text-[12.5px] outline-none data-[highlighted]:bg-(--surface2)"
          >
            {t('signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
