/** Job-description validation workflow (ported from domain/workflow/job-description.ts). */

const TRANSITIONS = {
  submit: { from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'IN_REVIEW' },
  approve: { from: ['IN_REVIEW'], to: 'VALIDATED' },
  request_changes: { from: ['IN_REVIEW'], to: 'CHANGES_REQUESTED' },
  archive: { from: ['VALIDATED', 'DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW'], to: 'ARCHIVED' },
  reopen: { from: ['CHANGES_REQUESTED'], to: 'DRAFT' },
};

export const ACTION_PERMISSION = {
  submit: 'update',
  approve: 'validate',
  request_changes: 'validate',
  archive: 'validate',
  reopen: 'update',
};

export function canTransition(from, action) {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(action) {
  return TRANSITIONS[action].to;
}

export class InvalidTransitionError extends Error {
  status = 409;
  constructor(from, action) {
    super(`Cannot ${action} a job description in state ${from}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.action = action;
  }
}

export function transition(from, action) {
  if (!canTransition(from, action)) throw new InvalidTransitionError(from, action);
  return { from, to: nextStatus(action), action };
}

export function availableActions(from) {
  return Object.keys(TRANSITIONS).filter((action) => canTransition(from, action));
}

export function mayEditInPlace(status) {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED';
}

export function requiresNewVersion(status) {
  return !mayEditInPlace(status);
}
