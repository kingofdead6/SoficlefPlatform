'use client';

import { useState, useTransition } from 'react';

import { setTaskStatus } from '@/app/actions/onboarding';
import { StatusBadge } from '@/components/ui';
import type { OnboardingTaskStatus } from '@/domain/onboarding/task';
import { cn } from '@/lib/cn';

/**
 * One line of the 30-day checklist.
 *
 * The tick is a real checkbox rather than a clickable div, so it is reachable by keyboard
 * and announced as a checkbox — the prototype used an `onclick` on a styled `<div>`,
 * which no screen reader could operate.
 */

const STATUS_LABEL: Record<OnboardingTaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
  DONE: 'Terminée',
  VALIDATED: 'Validée',
};

export function TaskRow({
  instanceId,
  milestoneId,
  dayLabelFr,
  titleFr,
  detailFr,
  isRecommended,
  status,
  dueLabel,
  overdue,
  dueSoon,
  canUpdate,
  canValidate,
}: {
  instanceId: string;
  milestoneId: string;
  dayLabelFr: string;
  titleFr: string;
  detailFr: string;
  isRecommended: boolean;
  status: OnboardingTaskStatus;
  dueLabel: string | null;
  overdue: boolean;
  dueSoon: boolean;
  canUpdate: boolean;
  canValidate: boolean;
}) {
  const [current, setCurrent] = useState<OnboardingTaskStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = current === 'DONE' || current === 'VALIDATED';

  function submit(next: OnboardingTaskStatus) {
    const previous = current;
    setError(null);
    // Optimistic: the row reflects the intent immediately and rolls back on failure.
    setCurrent(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('instanceId', instanceId);
      formData.set('milestoneId', milestoneId);
      formData.set('status', next);

      const result = await setTaskStatus(null, formData);
      if (!result.ok) {
        setCurrent(previous);
        setError(
          result.reason === 'forbidden'
            ? "Vous n'avez pas le droit de modifier cette étape."
            : result.reason === 'conflict'
              ? (result.message ?? 'Transition impossible.')
              : "L'étape n'a pas pu être mise à jour.",
        );
      }
    });
  }

  const checkboxId = `task-${milestoneId}`;

  return (
    <li
      className={cn(
        'rounded-(--radius) border bg-(--surface) px-4 py-3',
        overdue ? 'border-(--red)' : 'border-(--border)',
        done && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={done}
          disabled={!canUpdate || pending || current === 'VALIDATED'}
          onChange={(event) => submit(event.target.checked ? 'DONE' : 'TODO')}
          className="mt-1 size-4 shrink-0 accent-[var(--green)]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gold-strong rounded bg-(--gold-dim) px-1.5 py-0.5 font-mono text-[10px]">
              {dayLabelFr}
            </span>
            <label
              htmlFor={checkboxId}
              className={cn('text-text text-[13px] font-medium', done && 'line-through')}
            >
              {titleFr}
            </label>
            {isRecommended ? <StatusBadge label="Recommandé" tone="blue" /> : null}
          </div>

          <p className="text-text-muted mt-1 text-[12px] leading-relaxed">{detailFr}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={STATUS_LABEL[current]}
              tone={
                current === 'VALIDATED'
                  ? 'green'
                  : current === 'DONE'
                    ? 'green'
                    : current === 'BLOCKED'
                      ? 'red'
                      : current === 'IN_PROGRESS'
                        ? 'gold'
                        : 'neutral'
              }
            />
            {dueLabel ? (
              <span
                className={cn(
                  'font-mono text-[11px]',
                  overdue ? 'text-red font-semibold' : dueSoon ? 'text-gold-strong' : 'text-text-dim',
                )}
              >
                {overdue ? 'En retard · ' : dueSoon ? 'Échéance proche · ' : 'Échéance · '}
                {dueLabel}
              </span>
            ) : null}
          </div>

          {canUpdate ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {current !== 'BLOCKED' && !done ? (
                <SmallButton onClick={() => submit('BLOCKED')} disabled={pending}>
                  Signaler bloquée
                </SmallButton>
              ) : null}
              {current === 'BLOCKED' ? (
                <SmallButton onClick={() => submit('IN_PROGRESS')} disabled={pending}>
                  Débloquer
                </SmallButton>
              ) : null}
              {current === 'TODO' ? (
                <SmallButton onClick={() => submit('IN_PROGRESS')} disabled={pending}>
                  Démarrer
                </SmallButton>
              ) : null}
              {canValidate && current === 'DONE' ? (
                <SmallButton onClick={() => submit('VALIDATED')} disabled={pending} tone="green">
                  Valider
                </SmallButton>
              ) : null}
              {canValidate && current === 'VALIDATED' ? (
                <SmallButton onClick={() => submit('DONE')} disabled={pending}>
                  Retirer la validation
                </SmallButton>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-red mt-2 text-[12px]">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'green';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded border px-2 py-1 text-[11px] disabled:opacity-50',
        tone === 'green'
          ? 'border-(--green) text-green bg-white'
          : 'text-text-muted border-(--border) bg-(--surface2)',
      )}
    >
      {children}
    </button>
  );
}
