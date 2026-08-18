/**
 * The seven user profiles of CDC v0.1 §3 (ADR-005).
 *
 * CDC v1's four roles map on without loss:
 *   ADMIN_DRH → BIZ_ADMIN_CE
 *   DIR_PROD  → EMPLOYEE + MANAGER   (subject of an onboarding journey *and* head of a
 *                                     structure — two assignments, which is correct)
 *   EXECUTIVE → VIEWER
 *   CADRE_PROD → MANAGER
 *
 * This module is domain code: it imports nothing (ADR-019).
 */

export const ROLE_CODES = [
  'TECH_ADMIN',
  'BIZ_ADMIN_CE',
  'HEAD_CE',
  'HR',
  'MANAGER',
  'EMPLOYEE',
  'VIEWER',
] as const;

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
  TECH_ADMIN: {
    code: 'TECH_ADMIN',
    nameFr: 'Administrateur technique',
    nameEn: 'Technical administrator',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Utilisateurs, rôles, paramètres, sécurité, journaux.',
  },
  BIZ_ADMIN_CE: {
    code: 'BIZ_ADMIN_CE',
    nameFr: 'Administrateur métier Compétences & Emplois',
    nameEn: 'Skills & Employment business administrator',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Structures, emplois, compétences, matrices, workflows.',
  },
  HEAD_CE: {
    code: 'HEAD_CE',
    nameFr: 'Responsable Compétences & Emplois',
    nameEn: 'Head of Skills & Employment',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Validation, reporting, arbitrage, versioning.',
  },
  HR: {
    code: 'HR',
    nameFr: 'DRH / RH',
    nameEn: 'HR Director / HR',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Consultation et validation des emplois et parcours selon droits.',
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
  VIEWER: {
    code: 'VIEWER',
    nameFr: 'Lecteur / Direction',
    nameEn: 'Reader / management',
    naturalScope: 'GLOBAL',
    descriptionFr: 'Lecture seule : tableaux de bord, rapports, référentiels validés.',
  },
};

/** CDC v1 §2.3 roles, for migrating anything that still speaks the old vocabulary. */
export const LEGACY_ROLE_MAPPING: Record<string, RoleCode[]> = {
  ADMIN_DRH: ['BIZ_ADMIN_CE'],
  DIR_PROD: ['EMPLOYEE', 'MANAGER'],
  EXECUTIVE: ['VIEWER'],
  CADRE_PROD: ['MANAGER'],
};

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
