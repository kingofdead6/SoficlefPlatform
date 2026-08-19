'use client';

import { useState, useTransition } from 'react';

import { setUserStatus } from '@/app/actions/admin';
import { StatusBadge } from '@/components/ui';

/**
 * Suspends or re-enables an account.
 *
 * Suspension also drops the person's sessions server-side, so "suspended" means signed
 * out on their next request rather than whenever their cookie happens to expire.
 */
const LABEL = {
  ACTIVE: { label: 'Actif', tone: 'green' as const },
  SUSPENDED: { label: 'Suspendu', tone: 'gold' as const },
  DISABLED: { label: 'Désactivé', tone: 'red' as const },
};

export function UserStatusControl({
  userId,
  status,
  disabled,
}: {
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const next = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

  function toggle() {
    const previous = current;
    setError(null);
    setCurrent(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('userId', userId);
      formData.set('status', next);
      const result = await setUserStatus(null, formData);
      if (!result.ok) {
        setCurrent(previous);
        setError('Modification refusée.');
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusBadge label={LABEL[current].label} tone={LABEL[current].tone} />
      {disabled ? null : (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="text-text-muted rounded border border-(--border) bg-(--surface2) px-1.5 py-0.5 text-[11px] disabled:opacity-50"
        >
          {current === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
        </button>
      )}
      {error ? (
        <span role="alert" className="text-red text-[11px]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
