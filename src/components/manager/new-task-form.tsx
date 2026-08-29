'use client';

import { useState, useTransition } from 'react';

import { createManagerTask } from '@/app/actions/evaluations';
import type { ActionResult } from '@/application/shared/mutate';
import { useRouter } from '@/i18n/navigation';

/**
 * An ad-hoc task added to somebody's path.
 *
 * The owner field matters more than it looks: a task nobody owns is a task nobody does,
 * and naming the department is what lets the recruit see who to chase when it blocks.
 */

const DEPARTMENTS = [
  { value: 'MANAGER', labelFr: 'Vous (le responsable)' },
  { value: 'EMPLOYEE', labelFr: 'Le collaborateur' },
  { value: 'HR', labelFr: 'Ressources humaines' },
  { value: 'IT', labelFr: 'Informatique' },
  { value: 'HSE', labelFr: 'HSE' },
  { value: 'QUALITY', labelFr: 'Qualité' },
];

export function NewTaskForm({
  instanceId,
  recruitId,
  storageConfigured,
}: {
  instanceId: string;
  recruitId: string;
  /*
   * Passed in rather than read here: the storage check lives in a server-only module, and
   * a client component that imported it would drag server code into the browser bundle.
   */
  storageConfigured: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult<{ taskId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createManagerTask(null, formData);
      setState(result);
      if (result.ok) router.push(`/app/manager/recruits/${recruitId}`);
    });
  }

  return (
    <form action={handleSubmit} className="max-w-xl space-y-5">
      <input type="hidden" name="instanceId" value={instanceId} />

      <div>
        <label htmlFor="titleFr" className="text-text block text-[12px] font-medium">
          Intitulé
        </label>
        <input
          id="titleFr"
          name="titleFr"
          required
          minLength={2}
          maxLength={160}
          placeholder="Prise en main de la presse n°3"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="detailFr" className="text-text block text-[12px] font-medium">
          Consigne <span className="font-normal">(facultatif)</span>
        </label>
        <textarea
          id="detailFr"
          name="detailFr"
          rows={4}
          maxLength={2000}
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="dueDate" className="text-text block text-[12px] font-medium">
          Échéance <span className="font-normal">(facultatif)</span>
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
        <p className="text-text-dim mt-1 text-[11px]">
          Sans échéance, la tâche n’apparaît jamais comme en retard.
        </p>
      </div>

      <div>
        <label htmlFor="ownerDepartment" className="text-text block text-[12px] font-medium">
          Responsable de la tâche
        </label>
        <select
          id="ownerDepartment"
          name="ownerDepartment"
          defaultValue="MANAGER"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        >
          {DEPARTMENTS.map((department) => (
            <option key={department.value} value={department.value}>
              {department.labelFr}
            </option>
          ))}
        </select>
        <p className="text-text-dim mt-1 text-[11px]">
          Affiché au collaborateur : c’est à ce service qu’il s’adresse si la tâche bloque.
        </p>
      </div>

      {!storageConfigured ? (
        <p className="text-text-dim text-[11px]">
          Aucune pièce jointe : le stockage de fichiers n’est pas encore configuré.
        </p>
      ) : null}

      {state && !state.ok ? (
        <p role="alert" className="text-red text-[12px]">
          {state.message ?? 'La tâche n’a pas pu être créée.'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Création…' : 'Ajouter la tâche'}
      </button>
    </form>
  );
}
