/**
 * The four user profiles of CDC v1 §2.3.
 *
 * An earlier revision carried the seven profiles of CDC v0.1 §3, which split
 * administration three ways (technical, business, and the Head of Skills & Employment who
 * held validation) and added a read-only executive. Those four collapse into `ADMIN`:
 *
 *   TECH_ADMIN    → ADMIN   accounts, roles, audit trail, settings
 *   BIZ_ADMIN_CE  → ADMIN   structures, posts, competencies, templates
 *   HEAD_CE       → ADMIN   validation of job descriptions and competencies
 *   VIEWER        → ADMIN   read-only reporting, now covered by the wider role
 *
 * The trade is deliberate and worth stating: `ADMIN` can now both create an account and
 * assign it a post, so the provisioning chain no longer requires two people. It remains a
 * two-*step* process — an account with no post still lands on `/pending` — but it is no
 * longer a separation of duties.
 *
 * This module is domain code: it imports nothing (ADR-019).
 */

export const ROLE_CODES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export type ScopeKind = 'GLOBAL' | 'ORGANIZATION_UNIT' | 'SELF';

export interface RoleDefinition {
  code: RoleCode;
  nameFr: string;
  nameEn: string;
  /** What breadth the role is granted at when no explicit scope is attached. */
  naturalScope: ScopeKind;
  descriptionFr: string;
}

export const ROLES: Record<RoleCode, RoleDefinition> = {
  ADMIN: {
    code: 'ADMIN',
    nameFr: 'Administrateur',
    nameEn: 'Administrator',
    naturalScope: 'GLOBAL',
    descriptionFr:
      'Comptes, rôles, journaux, paramètres, structures, emplois, compétences et validation.',
  },
  HR: {
    code: 'HR',
    nameFr: 'DRH / RH',
    nameEn: 'HR Director / HR',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Affectations, parcours d’intégration, suivi et reporting RH.',
  },
  MANAGER: {
    code: 'MANAGER',
    nameFr: 'Manager / Responsable de structure',
    nameEn: 'Manager / structure head',
    naturalScope: 'ORGANIZATION_UNIT',
    descriptionFr: 'Consultation, évaluation, onboarding, validation sur son périmètre.',
  },
  EMPLOYEE: {
    code: 'EMPLOYEE',
    nameFr: 'Collaborateur',
    nameEn: 'Employee',
    naturalScope: 'SELF',
    descriptionFr: "Ses données, ses tâches d'intégration, ses justificatifs.",
  },
};

/**
 * Vocabularies that predate the current four, for migrating anything still speaking them.
 *
 * Both the CDC v1 §2.3 names and the seven CDC v0.1 codes are listed, because rows written
 * under either may still exist. `DIR_PROD` maps to two roles: a production director is the
 * subject of an onboarding journey *and* the head of a structure, which is two assignments
 * rather than one hybrid role.
 */
export const LEGACY_ROLE_MAPPING: Record<string, RoleCode[]> = {
  ADMIN_DRH: ['ADMIN'],
  DIR_PROD: ['EMPLOYEE', 'MANAGER'],
  EXECUTIVE: ['ADMIN'],
  CADRE_PROD: ['MANAGER'],

  TECH_ADMIN: ['ADMIN'],
  BIZ_ADMIN_CE: ['ADMIN'],
  HEAD_CE: ['ADMIN'],
  VIEWER: ['ADMIN'],
};

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
