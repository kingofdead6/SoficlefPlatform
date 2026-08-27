'use client';

import { useState, useTransition } from 'react';

import { assignUser } from '@/app/actions/assignments';
import { Modal } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * Gives an account a post — the step that turns `PENDING_ASSIGNMENT` into `ASSIGNED`.
 *
 * Only vacant posts are offered, because a seat can hold one person at a time and the
 * database enforces that with a partial unique index. Naming a template is optional: not
 * every arrival runs the 30-day checklist, and picking one here is what creates the
 * journey and its four surveys.
 */
export function AssignPositionDialog({
  userId,
  userName,
  positions,
  templates,
  trigger = 'Affecter',
}: {
  userId: string;
  userName: string;
  positions: { id: string; code: string; titleFr: string; occupancyFr: string | null }[];
  templates: { id: string; titleFr: string }[];
  trigger?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult<{ assignmentId: string }> | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await assignUser(null, formData);
      setState(result);
      if (result.ok) setOpen(false);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

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
          {trigger}
        </button>
      }
      title="Affecter à un poste"
      description={userName}
      closeLabel="Fermer"
    >
      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="userId" value={userId} />

        <div>
          <label htmlFor={`position-${userId}`} className="text-text block text-[12px] font-medium">
            Poste
          </label>
          <select
            id={`position-${userId}`}
            name="positionId"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="" disabled>
              Choisir un poste vacant
            </option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.titleFr}
                {position.occupancyFr ? ` — ${position.occupancyFr}` : ''}
              </option>
            ))}
          </select>
          {positions.length === 0 ? (
            <p className="text-text-dim mt-1 text-[11px]">
              Aucun poste vacant dans votre périmètre. Créez-en un depuis l’organisation.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`start-${userId}`} className="text-text block text-[12px] font-medium">
            Date de prise de poste
          </label>
          <input
            id={`start-${userId}`}
            name="startDate"
            type="date"
            required
            defaultValue={today}
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <label htmlFor={`template-${userId}`} className="text-text block text-[12px] font-medium">
            Parcours d’intégration <span className="font-normal">(facultatif)</span>
          </label>
          <select
            id={`template-${userId}`}
            name="templateId"
            defaultValue=""
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Aucun parcours</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.titleFr}
              </option>
            ))}
          </select>
          <p className="text-text-dim mt-1 text-[11px]">
            Choisir un parcours crée la checklist et les enquêtes J+7, J+30, J+60 et J+90.
          </p>
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {state.message ?? "L'affectation n'a pas pu être enregistrée."}
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
            disabled={positions.length === 0}
            className="rounded bg-(--red-brand) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            Affecter
          </button>
        </div>
      </form>
    </Modal>
  );
}
