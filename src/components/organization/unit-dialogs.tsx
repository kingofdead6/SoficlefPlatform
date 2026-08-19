'use client';

import { useState, useTransition } from 'react';

import {
  archiveOrganizationUnit,
  createOrganizationUnit,
  editOrganizationUnit,
} from '@/app/actions/organization';
import { Modal } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * Create, edit and archive dialogs for an organizational structure (CDC v0.1 §5).
 *
 * All three share one failure convention: the dialog stays open and shows the message,
 * so a rejected code clash or a refused archive is legible instead of silent.
 */

const TYPES = [
  { value: 'DIRECTION', label: 'Direction' },
  { value: 'STRUCTURE', label: 'Structure' },
  { value: 'UNITE_PRODUCTION', label: 'Unité de production' },
  { value: 'CELLULE', label: 'Cellule fonctionnelle' },
  { value: 'SERVICE', label: 'Service' },
];

const OCCUPANCIES = [
  { value: '', label: 'Non applicable' },
  { value: 'VACANT', label: 'Poste vacant' },
  { value: 'TO_FILL', label: 'À pourvoir' },
  { value: 'OCCUPIED', label: 'Pourvu' },
];

function messageFor(state: ActionResult<unknown>): string {
  if (state.ok) return '';
  if (state.reason === 'conflict') return state.message ?? 'Opération impossible.';
  if (state.reason === 'forbidden') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (state.reason === 'invalid') {
    const first = Object.values(state.fieldErrors ?? {})[0]?.[0];
    return first ?? 'Formulaire invalide.';
  }
  return "L'opération a échoué.";
}

const fieldClass =
  'mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]';

export function CreateUnitDialog({
  parents,
}: {
  parents: { id: string; code: string; nameFr: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult<{ id: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createOrganizationUnit(null, formData);
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
          className="rounded bg-(--gold) px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Nouvelle structure
        </button>
      }
      title="Nouvelle structure"
      description="Elle sera rattachée à la structure parente choisie."
      closeLabel="Fermer"
    >
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="unit-code" className="text-text block text-[12px] font-medium">
            Code
          </label>
          <input
            id="unit-code"
            name="code"
            required
            placeholder="DPR-LOG"
            className={`${fieldClass} font-mono uppercase`}
          />
          <p className="text-text-dim mt-1 text-[11px]">
            Majuscules, chiffres et tirets. Il identifie la structure de façon stable.
          </p>
        </div>

        <div>
          <label htmlFor="unit-name" className="text-text block text-[12px] font-medium">
            Nom
          </label>
          <input id="unit-name" name="nameFr" required className={fieldClass} />
        </div>

        <div>
          <label htmlFor="unit-type" className="text-text block text-[12px] font-medium">
            Type
          </label>
          <select id="unit-type" name="type" defaultValue="STRUCTURE" className={fieldClass}>
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unit-parent" className="text-text block text-[12px] font-medium">
            Rattachée à
          </label>
          <select id="unit-parent" name="parentId" defaultValue="" className={fieldClass}>
            <option value="">Aucune (racine)</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.code} — {parent.nameFr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unit-description" className="text-text block text-[12px] font-medium">
            Description <span className="text-text-dim font-normal">(facultatif)</span>
          </label>
          <textarea id="unit-description" name="descriptionFr" rows={3} className={fieldClass} />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {messageFor(state)}
          </p>
        ) : null}

        <Buttons pending={pending} onCancel={() => setOpen(false)} submitLabel="Créer" />
      </form>
    </Modal>
  );
}

export function EditUnitDialog({
  unit,
}: {
  unit: {
    id: string;
    nameFr: string;
    type: string;
    descriptionFr: string | null;
    headLabelFr: string | null;
    headOccupancy: 'VACANT' | 'TO_FILL' | 'OCCUPIED' | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult<{ id: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await editOrganizationUnit(null, formData);
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
          className="text-text-muted rounded border border-(--border) bg-(--surface2) px-2 py-1 text-[11px]"
        >
          Modifier
        </button>
      }
      title="Modifier la structure"
      description={unit.nameFr}
      closeLabel="Fermer"
    >
      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="id" value={unit.id} />

        <div>
          <label htmlFor={`name-${unit.id}`} className="text-text block text-[12px] font-medium">
            Nom
          </label>
          <input
            id={`name-${unit.id}`}
            name="nameFr"
            required
            defaultValue={unit.nameFr}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`type-${unit.id}`} className="text-text block text-[12px] font-medium">
            Type
          </label>
          <select
            id={`type-${unit.id}`}
            name="type"
            defaultValue={unit.type}
            className={fieldClass}
          >
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`head-${unit.id}`} className="text-text block text-[12px] font-medium">
            Responsable
          </label>
          <input
            id={`head-${unit.id}`}
            name="headLabelFr"
            defaultValue={unit.headLabelFr ?? ''}
            className={fieldClass}
          />
        </div>

        <div>
          <label
            htmlFor={`occupancy-${unit.id}`}
            className="text-text block text-[12px] font-medium"
          >
            État du poste
          </label>
          <select
            id={`occupancy-${unit.id}`}
            name="headOccupancy"
            defaultValue={unit.headOccupancy ?? ''}
            className={fieldClass}
          >
            {OCCUPANCIES.map((occupancy) => (
              <option key={occupancy.value} value={occupancy.value}>
                {occupancy.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`desc-${unit.id}`} className="text-text block text-[12px] font-medium">
            Description
          </label>
          <textarea
            id={`desc-${unit.id}`}
            name="descriptionFr"
            rows={3}
            defaultValue={unit.descriptionFr ?? ''}
            className={fieldClass}
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {messageFor(state)}
          </p>
        ) : null}

        <Buttons pending={pending} onCancel={() => setOpen(false)} submitLabel="Enregistrer" />
      </form>
    </Modal>
  );
}

export function ArchiveUnitButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function archive() {
    if (!window.confirm(`Archiver « ${name} » ? Elle disparaîtra des listes actives.`)) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', id);
      const result = await archiveOrganizationUnit(null, formData);
      if (!result.ok) setError(messageFor(result));
    });
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={archive}
        disabled={pending}
        className="text-red rounded border border-(--border) bg-(--surface2) px-2 py-1 text-[11px] disabled:opacity-50"
      >
        {pending ? 'Archivage…' : 'Archiver'}
      </button>
      {error ? (
        <span role="alert" className="text-red max-w-52 text-[11px]">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function Buttons({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="text-text-muted rounded border border-(--border) px-3 py-1.5 text-[12px]"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-(--gold) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {pending ? 'En cours…' : submitLabel}
      </button>
    </div>
  );
}
