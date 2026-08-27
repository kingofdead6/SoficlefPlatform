'use client';

import { useState, useTransition } from 'react';

import { acknowledgeDocument } from '@/app/actions/me';
import { StatusBadge } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * "I have read and accepted this document."
 *
 * Once accepted it becomes a badge rather than a disabled button: a greyed-out control
 * invites clicking to find out why, while a date answers the question outright.
 */
export function AcknowledgeButton({
  documentId,
  acceptedLabel,
}: {
  documentId: string;
  acceptedLabel: string | null;
}) {
  const [state, setState] = useState<ActionResult<{ acknowledged: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const accepted = acceptedLabel !== null || state?.ok === true;

  if (accepted) {
    return <StatusBadge label={acceptedLabel ?? 'Lu et accepté'} tone="green" />;
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => setState(await acknowledgeDocument(null, formData)))
      }
    >
      <input type="hidden" name="documentId" value={documentId} />
      <button
        type="submit"
        disabled={pending}
        className="text-red-strong rounded border border-(--red-brand) bg-(--red-dim) px-2 py-1 text-[11px] font-medium disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'J’ai lu et j’accepte'}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-red mt-1 text-[11px]">
          {state.message ?? 'Enregistrement impossible.'}
        </p>
      ) : null}
    </form>
  );
}
