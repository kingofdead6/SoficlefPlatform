'use client';

import { useState, useTransition } from 'react';

import { applyWorkflowAction, createDraft } from '@/app/actions/job-description';
import { StatusBadge } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';
import type { JobDescriptionStatus, WorkflowActionKind } from '@/domain/workflow/job-description';

/**
 * The version history of a job description and the §6.1 workflow buttons.
 *
 * Which buttons appear is decided on the server, by the state machine intersected with
 * the reader's permissions — this component only renders what it was given, so it cannot
 * offer a transition the server would refuse.
 */

const STATUS: Record<JobDescriptionStatus, { label: string; tone: 'neutral' | 'gold' | 'blue' | 'green' | 'red' }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  IN_REVIEW: { label: 'En revue', tone: 'blue' },
  CHANGES_REQUESTED: { label: 'À corriger', tone: 'gold' },
  VALIDATED: { label: 'Validée', tone: 'green' },
  ARCHIVED: { label: 'Archivée', tone: 'neutral' },
};

const ACTION_LABEL: Record<WorkflowActionKind, string> = {
  submit: 'Soumettre à la revue',
  approve: 'Valider',
  request_changes: 'Demander des corrections',
  archive: 'Archiver',
  reopen: 'Reprendre la rédaction',
};

export interface VersionRow {
  id: string;
  versionNumber: number;
  status: JobDescriptionStatus;
  reasonFr: string | null;
  createdLabel: string;
  validatedLabel: string | null;
  authorName: string | null;
  validatorName: string | null;
  actions: WorkflowActionKind[];
}

export function VersionPanel({
  jobDescriptionId,
  versions,
  mayDraft,
}: {
  jobDescriptionId: string;
  versions: VersionRow[];
  mayDraft: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(versionId: string, action: WorkflowActionKind) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('versionId', versionId);
      formData.set('action', action);
      const result = await applyWorkflowAction(null, formData);
      if (!result.ok) setError(describe(result));
    });
  }

  function draft(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createDraft(null, formData);
      if (!result.ok) setError(describe(result));
    });
  }

  return (
    <div className="space-y-4">
      {versions.length === 0 ? (
        <p className="text-text-muted text-[13px]">
          Cette fiche n&apos;a pas encore de version suivie. Créez-en une pour lancer le circuit
          de validation.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gold-strong rounded bg-(--gold-dim) px-1.5 py-0.5 font-mono text-[10px]">
                    v{version.versionNumber}
                  </span>
                  <StatusBadge
                    label={STATUS[version.status].label}
                    tone={STATUS[version.status].tone}
                  />
                  <span className="text-text-dim font-mono text-[11px]">
                    {version.createdLabel}
                  </span>
                </div>

                {version.actions.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {version.actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => act(version.id, action)}
                        disabled={pending}
                        className="text-text-muted rounded border border-(--border) bg-(--surface2) px-2 py-1 text-[11px] disabled:opacity-50"
                      >
                        {ACTION_LABEL[action]}
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>

              {version.reasonFr ? (
                <p className="text-text-muted mt-1.5 text-[12px]">Motif : {version.reasonFr}</p>
              ) : null}
              <p className="text-text-dim mt-1 text-[11px]">
                {version.authorName ? `Rédigée par ${version.authorName}` : 'Auteur inconnu'}
                {version.validatorName && version.validatedLabel
                  ? ` · Validée par ${version.validatorName} le ${version.validatedLabel}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {mayDraft ? (
        <form action={draft} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="jobDescriptionId" value={jobDescriptionId} />
          <div className="min-w-56 flex-1">
            <label htmlFor="draft-reason" className="text-text block text-[12px] font-medium">
              Motif de la nouvelle version
            </label>
            <input
              id="draft-reason"
              name="reasonFr"
              required
              minLength={3}
              placeholder="Réorganisation de la Direction de Production"
              className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-(--gold) px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {pending ? 'En cours…' : 'Nouvelle version'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-red text-[12px]">
          {error}
        </p>
      ) : null}

      <p className="text-text-dim text-[11px]">
        Une fiche validée ne peut pas être modifiée : une nouvelle version est créée, et la
        version validée reste telle qu&apos;elle a été signée.
      </p>
    </div>
  );
}

function describe(result: ActionResult<unknown>): string {
  if (result.ok) return '';
  if (result.reason === 'conflict') return result.message ?? 'Transition impossible.';
  if (result.reason === 'forbidden') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (result.reason === 'invalid') {
    return Object.values(result.fieldErrors ?? {})[0]?.[0] ?? 'Formulaire invalide.';
  }
  return "L'opération a échoué.";
}
