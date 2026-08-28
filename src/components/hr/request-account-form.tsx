'use client';

import { useState, useTransition } from 'react';

import { requestAccount } from '@/app/actions/account-requests';
import { Card, CardBody, CardTitle } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * Asking SI for an account.
 *
 * HR cannot create accounts — that is the separation the provisioning chain rests on — so
 * this opens a request. The form says so plainly rather than looking like a creation form
 * that mysteriously does not create anybody.
 */
export function RequestAccountForm() {
  const [state, setState] = useState<ActionResult<{ requestId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  if (state?.ok) {
    return (
      <Card accent="red">
        <CardTitle>Demande enregistrée</CardTitle>
        <CardBody className="mt-1">
          L’informatique la verra dans sa file de provisioning. Le compte apparaîtra dans
          « Comptes à affecter » une fois créé — c’est là que vous lui donnerez son poste.
        </CardBody>
        <button
          type="button"
          onClick={() => setState(null)}
          className="text-red-strong mt-3 text-[12px] font-medium"
        >
          Faire une autre demande
        </button>
      </Card>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => setState(await requestAccount(null, formData)))
      }
      className="max-w-xl space-y-5"
    >
      <div>
        <label htmlFor="candidateNameFr" className="text-text block text-[12px] font-medium">
          Nom du candidat
        </label>
        <input
          id="candidateNameFr"
          name="candidateNameFr"
          required
          minLength={2}
          maxLength={120}
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="plannedPositionFr" className="text-text block text-[12px] font-medium">
          Poste prévu
        </label>
        <input
          id="plannedPositionFr"
          name="plannedPositionFr"
          required
          minLength={2}
          maxLength={120}
          placeholder="Technicien de fabrication"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
        <p className="text-text-dim mt-1 text-[11px]">
          Indicatif : l’affectation réelle se fait à la création du compte, sur un poste
          existant.
        </p>
      </div>

      <div>
        <label htmlFor="plannedHireDate" className="text-text block text-[12px] font-medium">
          Date d’embauche prévue
        </label>
        <input
          id="plannedHireDate"
          name="plannedHireDate"
          type="date"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <fieldset>
        <legend className="text-text block text-[12px] font-medium">Urgence</legend>
        <div className="mt-2 flex gap-4">
          <label className="text-text flex items-center gap-2 text-[13px]">
            <input type="radio" name="urgency" value="NORMAL" defaultChecked />
            Normale
          </label>
          <label className="text-text flex items-center gap-2 text-[13px]">
            <input type="radio" name="urgency" value="URGENT" />
            Urgente
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="noteFr" className="text-text block text-[12px] font-medium">
          Précisions <span className="font-normal">(facultatif)</span>
        </label>
        <textarea
          id="noteFr"
          name="noteFr"
          rows={3}
          maxLength={1000}
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-red text-[12px]">
          {state.message ?? 'La demande n’a pas pu être enregistrée.'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Envoi…' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
