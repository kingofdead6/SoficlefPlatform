"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': document.cookie.match(/soficlef_csrf=([^;]+)/)?.[1] ?? '',
        },
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={loading}
      className="ml-auto rounded bg-(--surface2) px-3 py-1 text-sm"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
