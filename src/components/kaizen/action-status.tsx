'use client';

import { useState, useTransition } from 'react';

import { setKaizenActionStatus } from '@/app/actions/kaizen';
import { KAIZEN_STATUSES } from '@/domain/kaizen/status';
import { StatusBadge } from '@/components/ui';

/**
 * The status of one tracked Kaizen action, editable in place by whoever pilots it.
 *
 * Read-only for anybody without the permission, and the badge is the same in both cases,
 * so the page does not change shape depending on who is looking at it.
 */
const TONE: Record<string, 'green' | 'brand' | 'blue'> = {
  Clôturée: 'green',
  'En cours': 'brand',
  Planifiée: 'blue',
};

export function KaizenActionStatus({
  id,
  statusFr,
  editable,
}: {
  id: string;
  statusFr: string;
  editable: boolean;
}) {
  const [current, setCurrent] = useState(statusFr);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return <StatusBadge label={current} tone={TONE[current] ?? 'neutral'} />;
  }

  function change(next: string) {
    const previous = current;
    setError(null);
    setCurrent(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', id);
      formData.set('statusFr', next);
      const result = await setKaizenActionStatus(null, formData);
      if (!result.ok) {
        setCurrent(previous);
        setError('Refusé.');
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`kaizen-status-${id}`}>
        Statut de l&apos;action
      </label>
      <StatusBadge label={current} tone={TONE[current] ?? 'neutral'} />
      <select
        id={`kaizen-status-${id}`}
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="text-text-muted rounded border border-(--border) bg-(--surface) px-1.5 py-0.5 text-[11px] disabled:opacity-50"
      >
        {KAIZEN_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-red text-[11px]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
