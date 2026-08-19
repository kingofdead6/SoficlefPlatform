'use client';

import { useState, useTransition } from 'react';

import { recordAssessment } from '@/app/actions/competency';
import { Modal } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * Records a competency level for one person.
 *
 * The dialog closes itself once the mutation succeeds, and stays open showing the
 * message when it does not — a form that vanishes on failure loses what the user typed.
 *
 * The action is awaited inside the submit handler rather than through `useActionState`
 * plus an effect: closing the dialog is a consequence of *this submission*, not of a
 * state value changing, and reacting to the latter in an effect causes a cascading
 * render (react-hooks/set-state-in-effect).
 */
export function AssessmentDialog({
  competencyId,
  competencyName,
  subjectUserId,
  currentLevel,
  maxLevel,
}: {
  competencyId: string;
  competencyName: string;
  subjectUserId: string;
  currentLevel: number | null;
  maxLevel: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult<{ level: number }> | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await recordAssessment(null, formData);
      setState(result);
      if (result.ok) setOpen(false);
    });
  }

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
          className="text-gold-strong rounded border border-(--gold) bg-(--gold-dim) px-2 py-1 text-[11px] font-medium"
        >
          Évaluer
        </button>
      }
      title="Évaluer une compétence"
      description={competencyName}
      closeLabel="Fermer"
    >
      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="competencyId" value={competencyId} />
        <input type="hidden" name="subjectUserId" value={subjectUserId} />

        <div>
          <label
            htmlFor={`level-${competencyId}`}
            className="text-text block text-[12px] font-medium"
          >
            Niveau acquis
          </label>
          <select
            id={`level-${competencyId}`}
            name="level"
            defaultValue={currentLevel ?? ''}
            required
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="" disabled>
              Choisir un niveau
            </option>
            {Array.from({ length: maxLevel + 1 }, (_, level) => (
              <option key={level} value={level}>
                {level} / {maxLevel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`notes-${competencyId}`}
            className="text-text block text-[12px] font-medium"
          >
            Commentaire <span className="text-text-dim font-normal">(facultatif)</span>
          </label>
          <textarea
            id={`notes-${competencyId}`}
            name="notesFr"
            rows={3}
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {state.reason === 'forbidden'
              ? "Vous n'avez pas le droit d'évaluer cette personne."
              : state.reason === 'conflict'
                ? (state.message ?? 'Niveau invalide.')
                : "L'évaluation n'a pas pu être enregistrée."}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-muted rounded border border-(--border) px-3 py-1.5 text-[12px]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-(--gold) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
