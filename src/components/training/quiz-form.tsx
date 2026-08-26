'use client';

import { useState, useTransition } from 'react';

import { submitQuiz, type QuizOutcome } from '@/app/actions/training';
import { ProgressBar, StatusBadge } from '@/components/ui';
import type { ActionResult } from '@/application/shared/mutate';
import type { PublicQuestion } from '@/domain/training/quiz';

/**
 * A training quiz (CDC-2026 Module 6).
 *
 * The component never knows the right answers — they stay on the server, and the result
 * comes back from grading there. All this does is collect radio choices and show the
 * outcome.
 *
 * Each question is a `fieldset` with a `legend`, which is what makes a radio group
 * announce its own prompt to a screen reader; a bare label per option would read out five
 * unrelated choices with no question attached.
 */
export function QuizForm({
  moduleId,
  questions,
  passingScore,
}: {
  moduleId: string;
  questions: PublicQuestion[];
  passingScore: number;
}) {
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result: ActionResult<QuizOutcome> = await submitQuiz(null, formData);
      if (result.ok) {
        setOutcome(result.data);
        // Bring the result into view: on a long quiz it lands below the fold.
        requestAnimationFrame(() =>
          document.getElementById('quiz-result')?.scrollIntoView({ block: 'center' }),
        );
      } else {
        setError(
          result.reason === 'conflict'
            ? (result.message ?? 'Envoi impossible.')
            : result.reason === 'invalid'
              ? 'Répondez à toutes les questions avant de valider.'
              : "Le questionnaire n'a pas pu être envoyé.",
        );
      }
    });
  }

  if (questions.length === 0) {
    return (
      <p className="text-text-muted text-[13px]">
        Ce module ne comporte pas encore de questions. Le quiz sera disponible dès que la DRH
        aura fourni le support de formation.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="moduleId" value={moduleId} />

      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className="rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3"
        >
          <legend className="text-text px-1 text-[13px] font-medium">
            {index + 1}. {question.promptFr}
          </legend>
          <div className="mt-2 space-y-1.5">
            {question.options.map((option) => (
              <label
                key={option.id}
                className="text-text-muted flex items-center gap-2.5 rounded px-1 py-1 text-[13px]"
              >
                <input
                  type="radio"
                  name={`answer:${question.id}`}
                  value={option.id}
                  required
                  disabled={pending || outcome !== null}
                  className="accent-[var(--red-brand)]"
                />
                {option.labelFr}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error ? (
        <p role="alert" className="text-red text-[12px]">
          {error}
        </p>
      ) : null}

      {outcome ? (
        <div
          id="quiz-result"
          className="rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              label={outcome.passed ? 'Réussi' : 'Non validé'}
              tone={outcome.passed ? 'green' : 'red'}
            />
            <span className="text-text-muted text-[13px]">
              {outcome.correct} bonne(s) réponse(s) sur {outcome.total}
            </span>
            {outcome.certified ? <StatusBadge label="Certifié" tone="brand" /> : null}
          </div>

          <ProgressBar
            className="mt-3"
            value={outcome.score}
            label="Score obtenu"
            detail={`seuil ${passingScore}%`}
          />

          {!outcome.passed ? (
            <p className="text-text-muted mt-3 text-[12.5px]">
              Relisez le module et retentez le questionnaire : chaque tentative est conservée,
              et c&apos;est votre meilleur score qui compte.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setError(null);
            }}
            className="text-text-muted mt-4 rounded border border-(--border) bg-(--surface2) px-3 py-1.5 text-[12px]"
          >
            Refaire le questionnaire
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Correction…' : 'Valider le questionnaire'}
        </button>
      )}
    </form>
  );
}
