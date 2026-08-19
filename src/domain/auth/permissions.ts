import type { RoleCode } from './roles';

/**
 * The permission catalogue. A permission is `resource:action`, e.g.
 * `job_description:validate` — the shape CDC v0.1 §16 asks for.
 *
 * Resources for modules that are not built yet are declared here on purpose: the
 * permission set is the security contract, and adding a route in Part 6 or Part 11 must
 * not mean inventing a permission at the same time.
 */

export const RESOURCES = [
  'organization_unit',
  'job',
  'job_description',
  'competency',
  'assessment',
  'onboarding_template',
  'onboarding_instance',
  'onboarding_task',
  'remark',
  'kaizen_action',
  'document',
  'report',
  'dashboard',
  'notification',
  'user',
  'role',
  'audit_log',
  'setting',
] as const;

export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'validate',
  'assess',
  'export',
  'assign_role',
  'manage',
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionCode = `${Resource}:${Action}`;

export const permission = (resource: Resource, action: Action): PermissionCode =>
  `${resource}:${action}`;

const READ_ONLY_EVERYTHING: PermissionCode[] = [
  'organization_unit:read',
  'job:read',
  'job_description:read',
  'competency:read',
  'onboarding_instance:read',
  'report:read',
  'dashboard:read',
  'document:read',
  'notification:read',
];

/**
 * Role → permissions. Scope is a separate axis: holding `job:read` says *what* a role
 * may do, the attached scope says *where* (ADR-020, ADR-021). A MANAGER and an HR
 * director can both hold `job:read`; only HR sees every structure.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  /**
   * The technical administrator runs the platform, not the business reference frame:
   * accounts, roles, settings, logs, notifications. Deliberately no `job_description:validate`
   * and no `assessment:assess` — signing off a job description or rating a competency is a
   * business act, and CDC v0.1 §3 gives it to HEAD_CE and the managers, not to IT.
   */
  TECH_ADMIN: [
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'user:assign_role',
    'role:read',
    'role:create',
    'role:update',
    'role:delete',
    'audit_log:read',
    'audit_log:export',
    'setting:read',
    'setting:update',
    'organization_unit:read',
    'onboarding_instance:read',
    'notification:read',
    'notification:update',
    'dashboard:read',
    'report:read',
    'report:export',
  ],
  BIZ_ADMIN_CE: [
    'organization_unit:read',
    'organization_unit:create',
    'organization_unit:update',
    'organization_unit:delete',
    'job:read',
    'job:create',
    'job:update',
    'job:delete',
    'job_description:read',
    'job_description:create',
    'job_description:update',
    'competency:read',
    'competency:create',
    'competency:update',
    'competency:delete',
    'onboarding_template:read',
    'onboarding_template:create',
    'onboarding_template:update',
    'onboarding_instance:read',
    'onboarding_instance:create',
    'onboarding_instance:update',
    'onboarding_task:read',
    'onboarding_task:update',
    'kaizen_action:read',
    'kaizen_action:create',
    'kaizen_action:update',
    'document:read',
    'document:create',
    'document:update',
    'remark:read',
    'report:read',
    'report:export',
    'dashboard:read',
    'setting:read',
    'notification:read',
    'notification:update',
  ],
  HEAD_CE: [
    'organization_unit:read',
    'job:read',
    'job:update',
    'job_description:read',
    'job_description:update',
    'job_description:validate',
    'competency:read',
    'competency:validate',
    'assessment:read',
    'onboarding_template:read',
    'onboarding_instance:read',
    'onboarding_instance:validate',
    'onboarding_task:read',
    'onboarding_task:validate',
    'kaizen_action:read',
    'document:read',
    'remark:read',
    'report:read',
    'report:export',
    'dashboard:read',
    'notification:read',
    'notification:update',
  ],
  HR: [
    'organization_unit:read',
    'job:read',
    'job_description:read',
    'job_description:validate',
    'competency:read',
    'assessment:read',
    'onboarding_template:read',
    'onboarding_instance:read',
    'onboarding_instance:create',
    'onboarding_instance:update',
    'onboarding_task:read',
    'onboarding_task:update',
    'document:read',
    'document:create',
    'remark:read',
    'report:read',
    'report:export',
    'dashboard:read',
    'notification:read',
    'notification:update',
  ],
  MANAGER: [
    'organization_unit:read',
    'job:read',
    'job_description:read',
    'competency:read',
    'assessment:read',
    'assessment:assess',
    'onboarding_instance:read',
    'onboarding_task:read',
    'onboarding_task:update',
    'onboarding_task:validate',
    'kaizen_action:read',
    'kaizen_action:update',
    'document:read',
    // Deliberately no `remark:read`: the remarks journal is the collaborator's own
    // observations to HR and the DG. OQ-12's working default confines it to the author,
    // the HR chain and HEAD_CE — a structure head is not on that list.
    'report:read',
    'dashboard:read',
    'notification:read',
    'notification:update',
  ],
  EMPLOYEE: [
    'organization_unit:read',
    'job:read',
    'job_description:read',
    'competency:read',
    'assessment:read',
    'onboarding_instance:read',
    'onboarding_task:read',
    'onboarding_task:update',
    'remark:read',
    'remark:create',
    'document:read',
    'dashboard:read',
    'notification:read',
    'notification:update',
  ],
  VIEWER: [...READ_ONLY_EVERYTHING],
};

/** Every permission any role holds — the set seeded into the `permission` table. */
export const ALL_PERMISSIONS: PermissionCode[] = [
  ...new Set(Object.values(ROLE_PERMISSIONS).flat()),
].sort();

/**
 * A VIEWER must receive 403 on every mutation (Part 3 acceptance). Rather than trust the
 * list above to stay read-only by inspection, the invariant is asserted in the security
 * suite against this predicate.
 */
export const MUTATING_ACTIONS: Action[] = [
  'create',
  'update',
  'delete',
  'validate',
  'assess',
  'assign_role',
  'manage',
];

export function isMutating(action: Action): boolean {
  return MUTATING_ACTIONS.includes(action);
}

export function parsePermission(code: string): { resource: Resource; action: Action } | null {
  const [resource, action] = code.split(':');
  if (!resource || !action) return null;
  if (!(RESOURCES as readonly string[]).includes(resource)) return null;
  if (!(ACTIONS as readonly string[]).includes(action)) return null;
  return { resource: resource as Resource, action: action as Action };
}
