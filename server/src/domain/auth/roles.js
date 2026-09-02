/**
 * The four user profiles (ported from SoficlefPlatform src/domain/auth/roles.ts).
 * Domain code: imports nothing, pure data + helpers.
 */

export const ROLE_CODES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

export const ROLES = {
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
    descriptionFr: "Affectations, parcours d'intégration, suivi et reporting RH.",
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

/** Vocabularies that predate the current four, for migrating legacy rows. */
export const LEGACY_ROLE_MAPPING = {
  ADMIN_DRH: ['ADMIN'],
  DIR_PROD: ['EMPLOYEE', 'MANAGER'],
  EXECUTIVE: ['ADMIN'],
  CADRE_PROD: ['MANAGER'],

  TECH_ADMIN: ['ADMIN'],
  BIZ_ADMIN_CE: ['ADMIN'],
  HEAD_CE: ['ADMIN'],
  VIEWER: ['ADMIN'],
};

export function isRoleCode(value) {
  return ROLE_CODES.includes(value);
}
