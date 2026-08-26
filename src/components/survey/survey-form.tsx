'use client';

import { useState, useTransition } from 'react';

import { submitSurvey } from '@/app/actions/survey';
import { StatusBadge } from '@/components/ui';
import { SCORE_MAX, SCORE_MIN, SURVEY_INDICATORS } from '@/domain/survey/satisfaction';

/**
 * One satisfaction survey round (CDC-2026 Module 9).
 *
 * The five indicators are fixed by §9, so they are rendered from the domain constant
 * rather than from a question table: a survey whose wording drifts per person cannot be
 * averaged, and §10 asks for exactly that average.
 *
 * Each indicator is a radio group in a `fieldset` with a `legend`, so a screen reader
 * announces the indicator before its five options rather than reading them adrift.
 */

const LABELS: Record<(typeof SURVEY_INDICATORS)[number], string> = {
  WELCOME_QUALITY: "Qualité de l'accueil",
  SUPPORT_LEVEL: "Niveau de l'accompagnement",
  ROLE_CLARITY: 'Compréhension du poste assigné',
  MANAGER_RELATIONSHIP: 'Relationnel avec le manager',
  WORKING_CONDITIONS: 'Ergonomie des conditions de travail',
};

/** 1 is the worst, 5 the best. Naming both ends stops the scale being ambiguous. */
const SCALE_HINT = '1 = très insatisfait · 5 = très satisfait';

export function SurveyForm({ roundId, dayOffset }: { roundId: string; dayOffset: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitSurvey(null, formData);
      if (!result.ok) {
        setError(
          result.reason === 'conflict'
            ? (result.message ?? 'Envoi impossible.')
            : result.reason === 'forbidden'
              ? "Cette enquête ne vous est pas destinée."
              : "L'enquête n'a pas pu être envoyée.",
        );
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="roundId" value={roundId} />

      <p className="text-text-dim text-[11px]">{SCALE_HINT}</p>

      {SURVEY_INDICATORS.map((indicator) => (
        <fieldset key={indicator} className="border-t border-(--border) pt-3">
          <legend className="text-text pe-2 text-[13px] font-medium">{LABELS[indicator]}</legend>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, index) => SCORE_MIN + index).map(
              (score) => (
                <label
                  key={score}
                  className="text-text-muted flex items-center gap-1.5 text-[13px]"
                >
                  <input
                    type="radio"
                    name={indicator}
                    value={score}
                    required
                    disabled={pending}
                    className="accent-[var(--red-brand)]"
                  />
                  {score}
                </label>
              ),
            )}
          </div>
        </fieldset>
      ))}

      <div>
        <label
          htmlFor={`comment-${roundId}`}
          className="text-text block text-[12px] font-medium"
        >
          Commentaire <span className="text-text-dim font-normal">(facultatif)</span>
        </label>
        <textarea
          id={`comment-${roundId}`}
          name="commentFr"
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      {error ? (
        <p role="alert" className="text-red text-[12px]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Envoi…' : `Envoyer l'enquête J+${dayOffset}`}
        </button>
        <StatusBadge label="Une seule soumission" tone="neutral" />
      </div>
    </form>
  );
}
