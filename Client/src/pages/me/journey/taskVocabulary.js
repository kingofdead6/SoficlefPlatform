/**
 * The vocabulary of an onboarding task, shared by the roadmap (JourneyPage) and the task
 * detail page (TaskDetailPage) so the two never disagree about what "BLOQUÉE" is called or
 * which colour it wears.
 *
 * The keys mirror the server's Prisma enums exactly — OnboardingTaskStatus, OnboardingPhase
 * and TaskOwnerDepartment — so an enum value added server-side shows up here as a missing
 * key rather than as a silently mislabelled row.
 *
 * What this module exports is *translation keys*, not French strings: the words themselves
 * live in the catalogues and are resolved at the call site with `t()`. A module cannot call
 * a hook, so a French literal here would be a string no language switch could reach.
 */

/** Status → the catalogue key holding its label. */
export const STATUS_LABEL_KEYS = {
  TODO: 'me.vocabulary.status.TODO',
  IN_PROGRESS: 'me.vocabulary.status.IN_PROGRESS',
  BLOCKED: 'me.vocabulary.status.BLOCKED',
  DONE: 'me.vocabulary.status.DONE',
  VALIDATED: 'me.vocabulary.status.VALIDATED',
};

export const STATUS_STYLES = {
  TODO: 'bg-surface-2 text-text-dim',
  IN_PROGRESS: 'bg-status-blue/10 text-status-blue',
  BLOCKED: 'bg-status-red/10 text-status-red',
  DONE: 'bg-status-green/10 text-status-green',
  VALIDATED: 'bg-status-green/20 text-status-green',
};

/** The three phases of §2.1, in the order a recruit lives them. */
export const TASK_PHASES = [
  {
    id: 'PRE_ONBOARDING',
    labelKey: 'me.vocabulary.phases.PRE_ONBOARDING.label',
    detailKey: 'me.vocabulary.phases.PRE_ONBOARDING.detail',
  },
  {
    id: 'DAY_ONE',
    labelKey: 'me.vocabulary.phases.DAY_ONE.label',
    detailKey: 'me.vocabulary.phases.DAY_ONE.detail',
  },
  {
    id: 'PROBATION',
    labelKey: 'me.vocabulary.phases.PROBATION.label',
    detailKey: 'me.vocabulary.phases.PROBATION.detail',
  },
];

/**
 * Who owns a step when it is blocked. The `detailKey` says what that department can unblock,
 * because "HR" alone does not tell a new arrival whether to write, call or wait.
 */
export const OWNER_DEPARTMENTS = {
  HR: { labelKey: 'me.vocabulary.owners.HR.label', detailKey: 'me.vocabulary.owners.HR.detail' },
  IT: { labelKey: 'me.vocabulary.owners.IT.label', detailKey: 'me.vocabulary.owners.IT.detail' },
  HSE: { labelKey: 'me.vocabulary.owners.HSE.label', detailKey: 'me.vocabulary.owners.HSE.detail' },
  QUALITY: {
    labelKey: 'me.vocabulary.owners.QUALITY.label',
    detailKey: 'me.vocabulary.owners.QUALITY.detail',
  },
  MANAGER: {
    labelKey: 'me.vocabulary.owners.MANAGER.label',
    detailKey: 'me.vocabulary.owners.MANAGER.detail',
  },
  EMPLOYEE: {
    labelKey: 'me.vocabulary.owners.EMPLOYEE.label',
    detailKey: 'me.vocabulary.owners.EMPLOYEE.detail',
  },
};
