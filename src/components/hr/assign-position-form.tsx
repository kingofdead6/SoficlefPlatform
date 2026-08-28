'use client';

import { useState, useTransition } from 'react';

import { assignUser } from '@/app/actions/assignments';
import { Card, CardBody, CardTitle } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';
import { useRouter } from '@/i18n/navigation';

/**
 * The full assignment form.
 *
 * Only vacant posts are offered: a seat holds one person at a time, and the database
 * enforces that with a partial unique index rather than trusting this list to be right.
 *
 * The manager override is deliberately optional and explained. Most people report to
 * whoever holds the parent post; naming somebody here is for the exceptions — a secondment,
 * a temporary reporting line — and keeping that on the assignment stops it distorting the
 * position tree for everybody else.
 */
export function AssignPositionForm({
  userId,
  positions,
  templates,
  managers,
  defaultStartDate,
}: {
  userId: string;
  positions: { id: string; code: string; titleFr: string; occupancyFr: string | null }[];
  templates: { id: string; titleFr: string }[];
  managers: { id: string; displayName: string }[];
  defaultStartDate?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult<{ assignmentId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await assignUser(null, formData);
      setState(result);
      // On success the person is no longer in the queue, so the queue is where to land.
      if (result.ok) router.push('/app/hr/employees/unassigned');
    });
  }

  if (positions.length === 0) {
    return (
      <Card accent="red">
        <CardTitle>Aucun poste vacant</CardTitle>
        <CardBody className="mt-1">
          Il n’y a aucun poste libre dans votre périmètre. Créez-en un depuis les fiches de
          poste avant de pouvoir affecter quelqu’un.
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={handleSubmit} className="max-w-xl space-y-5">
      <input type="hidden" name="userId" value={userId} />

      <div>
        <label htmlFor="positionId" className="text-text block text-[12px] font-medium">
          Poste
        </label>
        <select
          id="positionId"
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
        <p className="text-text-dim mt-1 text-[11px]">
          La structure et le lien hiérarchique découlent du poste choisi.
        </p>
      </div>

      <div>
        <label htmlFor="startDate" className="text-text block text-[12px] font-medium">
          Date de prise de poste
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={defaultStartDate ?? today}
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="templateId" className="text-text block text-[12px] font-medium">
          Parcours d’intégration <span className="font-normal">(facultatif)</span>
        </label>
        <select
          id="templateId"
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

      <div>
        <label htmlFor="managerOverrideId" className="text-text block text-[12px] font-medium">
          Responsable différent <span className="font-normal">(facultatif)</span>
        </label>
        <select
          id="managerOverrideId"
          name="managerOverrideId"
          defaultValue=""
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        >
          <option value="">Celui du poste parent</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.displayName}
            </option>
          ))}
        </select>
        <p className="text-text-dim mt-1 text-[11px]">
          À ne renseigner que pour une exception — un détachement, un intérim. Sinon le lien
          hiérarchique suit l’organigramme.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-red text-[12px]">
          {state.message ?? 'L’affectation n’a pas pu être enregistrée.'}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Confirmer l’affectation'}
        </button>
        <span className="text-text-dim text-[11px]">
          Le parcours est généré et le poste marqué occupé.
        </span>
      </div>
    </form>
  );
}
