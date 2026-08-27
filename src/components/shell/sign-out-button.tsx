'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Sign out, as a plain button.
 *
 * The user menu has its own copy of this inside a dropdown item; this is for the pages
 * that have no shell around them — `/pending`, where signing out is the only action
 * available — and shares the same endpoint and CSRF handling.
 */
export function SignOutButton() {
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
    <button
      type="button"
      disabled={isSigningOut}
      onClick={() => void signOut()}
      className="rounded-md border border-(--border) px-4 py-2.5 text-[13px] font-medium text-text hover:bg-(--surface2) disabled:opacity-60"
    >
      {t('signOut')}
    </button>
  );
}
