/**
 * The French vocabulary of an onboarding task, shared by the roadmap (JourneyPage) and the
 * task detail page (TaskDetailPage) so the two never disagree about what "BLOQUÉE" is
 * called or which colour it wears.
 *
 * The keys mirror the server's Prisma enums exactly — OnboardingTaskStatus, OnboardingPhase
 * and TaskOwnerDepartment — so an enum value added server-side shows up here as a missing
 * key rather than as a silently mislabelled row.
 */

export const STATUS_LABELS = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
  DONE: 'Terminée',
  VALIDATED: 'Validée',
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
    labelFr: 'Avant l’arrivée',
    detailFr: 'Ce qui se prépare avant votre premier jour : dossier administratif, contrat, accès.',
  },
  {
    id: 'DAY_ONE',
    labelFr: 'Jour J',
    detailFr: 'La journée d’accueil : badge, poste de travail, présentation de l’équipe.',
  },
  {
    id: 'PROBATION',
    labelFr: 'Période d’essai',
    detailFr: 'La prise de poste : formations, points d’étape et évaluations.',
  },
];

/**
 * Who owns a step when it is blocked. The `detailFr` says what that department can unblock,
 * because "RH" alone does not tell a new arrival whether to write, call or wait.
 */
export const OWNER_DEPARTMENTS = {
  HR: { labelFr: 'Ressources humaines', detailFr: 'contrat, dossier administratif, justificatifs.' },
  IT: { labelFr: 'Informatique', detailFr: 'compte, matériel, accès aux applications.' },
  HSE: { labelFr: 'Hygiène, sécurité et environnement', detailFr: 'équipements de protection, consignes de sécurité.' },
  QUALITY: { labelFr: 'Qualité', detailFr: 'procédures, documents du système de management.' },
  MANAGER: { labelFr: 'Votre manager', detailFr: 'objectifs, points d’étape, validation des étapes.' },
  EMPLOYEE: { labelFr: 'Vous', detailFr: 'cette étape vous revient : rien ne vous attend côté services.' },
};
