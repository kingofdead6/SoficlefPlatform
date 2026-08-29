'use client';

import { useState, useTransition } from 'react';

import { saveEvaluation } from '@/app/actions/evaluations';
import { Card, CardBody, CardTitle } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';
import { useRouter } from '@/i18n/navigation';

/**
 * The milestone evaluation form.
 *
 * Four criteria on a 1–5 scale, then a recommendation. The scale is labelled at every
 * point rather than only at its ends: "3 out of 5" means different things to different
 * people, and a review that two managers read differently is not comparable data.
 *
 * Saving as a draft and submitting are separate buttons because they are separate acts —
 * a submitted review is the manager's word to HR and cannot be edited afterwards.
 */

const CRITERIA = [
  {
    name: 'scoreSkills',
    labelFr: 'Compétences techniques',
    helpFr: 'Maîtrise des gestes et des outils du poste.',
  },
  {
    name: 'scoreAutonomy',
    labelFr: 'Autonomie',
    helpFr: 'Capacité à avancer sans supervision continue.',
  },
  {
    name: 'scoreIntegration',
    labelFr: 'Intégration',
    helpFr: 'Place prise dans l’équipe et dans les circuits de travail.',
  },
  {
    name: 'scoreBehaviour',
    labelFr: 'Comportement professionnel',
    helpFr: 'Ponctualité, sécurité, respect des procédures.',
  },
] as const;

const SCALE = [
  { value: 1, labelFr: 'Insuffisant' },
  { value: 2, labelFr: 'En deçà' },
  { value: 3, labelFr: 'Conforme' },
  { value: 4, labelFr: 'Solide' },
  { value: 5, labelFr: 'Remarquable' },
];

const RECOMMENDATIONS = [
  { value: 'CONFIRM', labelFr: 'Confirmer', helpFr: 'La période d’essai est concluante.' },
  { value: 'EXTEND', labelFr: 'Prolonger', helpFr: 'Il manque du temps pour trancher.' },
  { value: 'TERMINATE', labelFr: 'Ne pas confirmer', helpFr: 'L’essai n’est pas concluant.' },
];

export function EvaluationForm({
  evaluationId,
  readOnly,
  defaults,
}: {
  evaluationId: string;
  readOnly: boolean;
  defaults: {
    scoreSkills: number | null;
    scoreAutonomy: number | null;
    scoreIntegration: number | null;
    scoreBehaviour: number | null;
    commentFr: string | null;
    recommendation: string | null;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult<{ evaluationId: string }> | null>(null);
  const [pending, startTransition] = useTransition();

  function submitWith(mode: 'draft' | 'submit') {
    return (formData: FormData) => {
      formData.set('submit', mode);
      startTransition(async () => {
        const result = await saveEvaluation(null, formData);
        setState(result);
        if (result.ok && mode === 'submit') router.push('/app/manager/evaluations');
      });
    };
  }

  if (readOnly) {
    return (
      <Card>
        <CardTitle>Évaluation transmise</CardTitle>
        <CardBody className="mt-1">
          Elle a été transmise aux RH et ne peut plus être modifiée. Une recommandation qui
          change après lecture n’en est plus une.
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={submitWith('draft')} className="max-w-2xl space-y-6">
      <input type="hidden" name="evaluationId" value={evaluationId} />

      {CRITERIA.map((criterion) => (
        <fieldset key={criterion.name}>
          <legend className="text-text text-[13px] font-medium">{criterion.labelFr}</legend>
          <p className="text-text-dim mb-2 text-[11px]">{criterion.helpFr}</p>

          <div className="flex flex-wrap gap-3">
            {SCALE.map((step) => (
              <label
                key={step.value}
                className="text-text flex items-center gap-1.5 text-[12px]"
              >
                <input
                  type="radio"
                  name={criterion.name}
                  value={step.value}
                  required
                  defaultChecked={defaults[criterion.name] === step.value}
                />
                <span className="font-mono">{step.value}</span>
                <span className="text-text-muted">{step.labelFr}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="text-text text-[13px] font-medium">Recommandation</legend>
        <p className="text-text-dim mb-2 text-[11px]">
          Transmise aux RH. À la fin de la période d’essai, elle détermine l’issue enregistrée.
        </p>
        <div className="space-y-2">
          {RECOMMENDATIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="recommendation"
                value={option.value}
                required
                defaultChecked={defaults.recommendation === option.value}
                className="mt-1"
              />
              <span>
                <span className="text-text font-medium">{option.labelFr}</span>
                <span className="text-text-dim block text-[11px]">{option.helpFr}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="commentFr" className="text-text block text-[13px] font-medium">
          Commentaire
        </label>
        <p className="text-text-dim mb-1 text-[11px]">
          Ce que les notes ne disent pas : le contexte, les progrès, ce qui reste à faire.
        </p>
        <textarea
          id="commentFr"
          name="commentFr"
          rows={5}
          maxLength={4000}
          defaultValue={defaults.commentFr ?? ''}
          className="w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-red text-[12px]">
          {state.message ?? 'L’évaluation n’a pas pu être enregistrée.'}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-[12px] text-green-700 dark:text-green-400">
          Brouillon enregistré.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-(--border) px-4 py-2 text-[13px] font-medium disabled:opacity-60"
        >
          Enregistrer le brouillon
        </button>
        <button
          type="submit"
          formAction={submitWith('submit')}
          disabled={pending}
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          Transmettre aux RH
        </button>
        <span className="text-text-dim text-[11px]">
          Une évaluation transmise ne peut plus être modifiée.
        </span>
      </div>
    </form>
  );
}
