'use client';

import { useState, useTransition } from 'react';

import { grantRole } from '@/app/actions/admin';
import { Modal } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';
import { ROLE_CODES, ROLES } from '@/domain/auth/roles';

/**
 * Grants a role, optionally narrowed to one organizational unit.
 *
 * A MANAGER assignment without a unit would be a role with no perimeter, which CDC v0.1
 * §3 forbids — so the unit picker becomes required as soon as MANAGER is chosen, and the
 * server refuses the pair anyway.
 */
export function AssignRoleDialog({
  userId,
  userName,
  units,
  disabled,
}: {
  userId: string;
  userName: string;
  units: { id: string; code: string; nameFr: string }[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>('EMPLOYEE');
  const [state, setState] = useState<ActionResult<{ userRoleId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  const needsUnit = role === 'MANAGER';

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await grantRole(null, formData);
      setState(result);
      if (result.ok) setOpen(false);
    });
  }

  if (disabled) {
    return <span className="text-text-dim text-[11px]">Votre compte</span>;
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
          className="text-red-strong rounded border border-(--red-brand) bg-(--red-dim) px-2 py-1 text-[11px] font-medium"
        >
          Attribuer un rôle
        </button>
      }
      title="Attribuer un rôle"
      description={userName}
      closeLabel="Fermer"
    >
      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="userId" value={userId} />

        <div>
          <label htmlFor={`role-${userId}`} className="text-text block text-[12px] font-medium">
            Rôle
          </label>
          <select
            id={`role-${userId}`}
            name="roleCode"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            {ROLE_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {ROLES[code].nameFr}
              </option>
            ))}
          </select>
          <p className="text-text-dim mt-1 text-[11px]">
            {ROLES[role as keyof typeof ROLES]?.descriptionFr}
          </p>
        </div>

        <div>
          <label htmlFor={`unit-${userId}`} className="text-text block text-[12px] font-medium">
            Périmètre {needsUnit ? '' : <span className="font-normal">(rôle global)</span>}
          </label>
          <select
            id={`unit-${userId}`}
            name="organizationUnitId"
            required={needsUnit}
            disabled={!needsUnit}
            defaultValue=""
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px] disabled:opacity-50"
          >
            <option value="">{needsUnit ? 'Choisir une structure' : 'Toute l’organisation'}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} — {unit.nameFr}
              </option>
            ))}
          </select>
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-red text-[12px]">
            {state.message ?? "Le rôle n'a pas pu être attribué."}
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
            className="rounded bg-(--red-brand) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Attribution…' : 'Attribuer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
