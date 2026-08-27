'use client';

import { useState, useTransition } from 'react';

import { submitPersonalFile } from '@/app/actions/me';
import { Modal } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * Declaring a personal document handed over.
 *
 * There is no file input, and that is deliberate rather than unfinished: no storage
 * backend is configured (OQ-14/OQ-15), and an input that accepted a file only to discard
 * it would be worse than none — the person would believe they had submitted it.
 *
 * The form says so plainly and records how the paper actually reached HR, which is how the
 * process runs today. When storage arrives, the input joins this form and the surrounding
 * workflow is unchanged.
 */
export function SubmitFileForm({
  fileId,
  label,
  storageConfigured,
}: {
  fileId: string;
  label: string;
  storageConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult<{ fileId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setState(null);
      }}
      trigger={
        <button
          type="button"
          className="text-red-strong rounded border border-(--red-brand) bg-(--red-dim) px-2 py-1 text-[11px] font-medium"
        >
          Déclarer transmis
        </button>
      }
      title="Déclarer une pièce transmise"
      description={label}
      closeLabel="Fermer"
    >
      <form
        action={(formData) =>
          startTransition(async () => {
            const result = await submitPersonalFile(null, formData);
            setState(result);
            if (result.ok) setOpen(false);
          })
        }
        className="space-y-4"
      >
        <input type="hidden" name="fileId" value={fileId} />

        {!storageConfigured ? (
          <p className="text-text-muted rounded-(--radius) border border-(--border) bg-(--surface2) p-3 text-[12px]">
            Le dépôt de fichier n’est pas encore activé sur la plateforme. Indiquez comment
            vous avez transmis la pièce ; les RH la valideront de leur côté.
          </p>
        ) : null}

        <div>
          <label htmlFor={`note-${fileId}`} className="text-text block text-[12px] font-medium">
            Comment avez-vous transmis cette pièce ?
          </label>
          <textarea
            id={`note-${fileId}`}
            name="noteFr"
            required
            rows={3}
            maxLength={500}
            placeholder="Remise en main propre au service RH le 12/03, ou envoyée par e-mail à…"
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {state.message ?? 'Enregistrement impossible.'}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-(--border) px-3 py-1.5 text-[12px]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-(--red-brand) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Enregistrement…' : 'Déclarer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
