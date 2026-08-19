/**
 * The job-description validation workflow (CDC v0.1 §6.1, §9).
 *
 *   Brouillon → En revue → À corriger → Validée → Archivée
 *
 * Two acceptance criteria from §19.1 are encoded here rather than left to the callers:
 *
 *   - "Une fiche de poste validée ne peut être modifiée sans créer une nouvelle version."
 *     `VALIDATED` accepts no edit transition; `mayEditInPlace` says so, and the
 *     application layer forks a new DRAFT instead.
 *   - Every transition is auditable: `transition()` returns the pair it moved between so
 *     the caller writes a WorkflowAction row with a real from/to, not a guess.
 *
 * Domain code: imports nothing (ADR-019).
 */

export type JobDescriptionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'VALIDATED'
  | 'ARCHIVED';

export type WorkflowActionKind =
  | 'submit'
  | 'approve'
  | 'request_changes'
  | 'archive'
  | 'reopen';

/** Which action moves which state where. The single source of truth for the machine. */
const TRANSITIONS: Record<WorkflowActionKind, { from: JobDescriptionStatus[]; to: JobDescriptionStatus }> = {
  submit: { from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'IN_REVIEW' },
  approve: { from: ['IN_REVIEW'], to: 'VALIDATED' },
  request_changes: { from: ['IN_REVIEW'], to: 'CHANGES_REQUESTED' },
  archive: { from: ['VALIDATED', 'DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW'], to: 'ARCHIVED' },
  reopen: { from: ['CHANGES_REQUESTED'], to: 'DRAFT' },
};

/** The permission each action requires, so the route and the machine cannot disagree. */
export const ACTION_PERMISSION: Record<WorkflowActionKind, 'update' | 'validate'> = {
  submit: 'update',
  approve: 'validate',
  request_changes: 'validate',
  archive: 'validate',
  reopen: 'update',
};

export function canTransition(from: JobDescriptionStatus, action: WorkflowActionKind): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(action: WorkflowActionKind): JobDescriptionStatus {
  return TRANSITIONS[action].to;
}

export class InvalidTransitionError extends Error {
  readonly status = 409;

  constructor(
    readonly from: JobDescriptionStatus,
    readonly action: WorkflowActionKind,
  ) {
    super(`Cannot ${action} a job description in state ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionResult {
  from: JobDescriptionStatus;
  to: JobDescriptionStatus;
  action: WorkflowActionKind;
}

/** Apply an action, or throw if the machine does not allow it from this state. */
export function transition(
  from: JobDescriptionStatus,
  action: WorkflowActionKind,
): TransitionResult {
  if (!canTransition(from, action)) throw new InvalidTransitionError(from, action);
  return { from, to: nextStatus(action), action };
}

/** The actions offered on a version in this state — what the UI renders as buttons. */
export function availableActions(from: JobDescriptionStatus): WorkflowActionKind[] {
  return (Object.keys(TRANSITIONS) as WorkflowActionKind[]).filter((action) =>
    canTransition(from, action),
  );
}

/**
 * §19.1: a validated (or archived) version is immutable. Editing one forks a new DRAFT;
 * it is never rewritten in place.
 */
export function mayEditInPlace(status: JobDescriptionStatus): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED';
}

/** True when a new draft must be forked rather than the current version edited. */
export function requiresNewVersion(status: JobDescriptionStatus): boolean {
  return !mayEditInPlace(status);
}
