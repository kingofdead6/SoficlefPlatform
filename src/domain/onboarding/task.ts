/**
 * The onboarding task state machine and progress arithmetic (CDC v0.1 §8, §9).
 *
 *   À faire → En cours → Bloquée → Terminée → Validée
 *
 * Two rules matter beyond the diagram:
 *
 *   - Validation is a *manager's* act on top of the collaborator's completion, so
 *     `VALIDATED` is only reachable from `DONE`. It is not a shortcut for "done".
 *   - §19.1 requires late tasks to be identifiable. Lateness is derived from the due
 *     date and the current status, never stored, so a task cannot be stale-flagged.
 *
 * Domain code: imports nothing (ADR-019).
 */

export type OnboardingTaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'VALIDATED';

/** Which statuses may follow a given one. */
const ALLOWED_NEXT: Record<OnboardingTaskStatus, OnboardingTaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
  IN_PROGRESS: ['TODO', 'BLOCKED', 'DONE'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'DONE'],
  // Un-ticking a task is legitimate — somebody ticks the wrong row — but only back to
  // an open state, and only while a manager has not signed it off.
  DONE: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'VALIDATED'],
  // A validated task is reopened by the validator withdrawing the sign-off.
  VALIDATED: ['DONE'],
};

/** Statuses that count as "the work is finished". */
export const COMPLETED_STATUSES: OnboardingTaskStatus[] = ['DONE', 'VALIDATED'];

export function isCompleted(status: OnboardingTaskStatus): boolean {
  return COMPLETED_STATUSES.includes(status);
}

/** Moving to `VALIDATED` requires the `onboarding_task:validate` permission, not `update`. */
export function requiredActionFor(next: OnboardingTaskStatus): 'update' | 'validate' {
  return next === 'VALIDATED' ? 'validate' : 'update';
}

export function canTransition(from: OnboardingTaskStatus, to: OnboardingTaskStatus): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

export class InvalidTaskTransitionError extends Error {
  readonly status = 409;

  constructor(
    readonly from: OnboardingTaskStatus,
    readonly to: OnboardingTaskStatus,
  ) {
    super(`Cannot move an onboarding task from ${from} to ${to}`);
    this.name = 'InvalidTaskTransitionError';
  }
}

export function assertTransition(from: OnboardingTaskStatus, to: OnboardingTaskStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) throw new InvalidTaskTransitionError(from, to);
}

export interface TaskLike {
  status: OnboardingTaskStatus;
  dueDate: Date | null;
}

/**
 * A task is late when its deadline has passed and the work is not finished. Comparison
 * is on whole days so a task due today is not late at 00:01 (§19.1).
 */
export function isOverdue(task: TaskLike, today: Date = new Date()): boolean {
  if (!task.dueDate || isCompleted(task.status)) return false;
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return day(task.dueDate) < day(today);
}

/** A task not yet late but due within `days` — what the reminder job picks up (§8 "Alertes"). */
export function isDueSoon(task: TaskLike, days = 3, today: Date = new Date()): boolean {
  if (!task.dueDate || isCompleted(task.status) || isOverdue(task, today)) return false;
  const dayInMs = 24 * 60 * 60 * 1000;
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return (day(task.dueDate) - day(today)) / dayInMs <= days;
}

export interface OnboardingProgress {
  total: number;
  completed: number;
  validated: number;
  blocked: number;
  overdue: number;
  /** 0–100, rounded. 0 when the journey has no tasks, never NaN. */
  percent: number;
}

export function progressOf(tasks: TaskLike[], today: Date = new Date()): OnboardingProgress {
  const completed = tasks.filter((task) => isCompleted(task.status)).length;
  return {
    total: tasks.length,
    completed,
    validated: tasks.filter((task) => task.status === 'VALIDATED').length,
    blocked: tasks.filter((task) => task.status === 'BLOCKED').length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
  };
}

/** The due date a milestone gets when a journey is instantiated: start + dayOffset. */
export function dueDateFor(startDate: Date, dayOffset: number): Date {
  const due = new Date(startDate);
  due.setDate(due.getDate() + dayOffset);
  return due;
}
