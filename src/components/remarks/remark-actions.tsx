'use client';

import { useState, useTransition } from 'react';

import { deleteRemark } from '@/app/actions/remarks';

/** Withdraws one's own remark, with a confirmation — deletion is not undoable. */
export function DeleteRemarkButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm('Supprimer définitivement cette remarque ?')) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', id);
      const result = await deleteRemark(null, formData);
      if (!result.ok) setError('Suppression impossible.');
    });
  }

  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-red text-[11px]">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-red rounded px-1.5 py-0.5 text-[11px] disabled:opacity-50"
      >
        {pending ? 'Suppression…' : 'Supprimer'}
      </button>
    </span>
  );
}
