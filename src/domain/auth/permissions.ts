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
  /**
   * The post — the seat on the org chart. Administered by the business (BIZ_ADMIN_CE),
   * because defining what a job *is* is a business act, not an IT one.
   */
  'position',
  /**
   * Who holds which post. Deliberately separate from `position` and from `user`: the
   * provisioning chain has two owners, and this is the half that belongs to HR.
   */
  'assignment',
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
  'survey',
  'training',
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


/**
 * Role → permissions. Scope is a separate axis: holding `job:read` says *what* a role
 * may do, the attached scope says *where* (ADR-020, ADR-021). A MANAGER and an HR
 * director can both hold `job:read`; only HR sees every structure.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  /**
   * One administrator, holding what the previous TECH_ADMIN, BIZ_ADMIN_CE, HEAD_CE and
   * VIEWER held between them: the platform (accounts, roles, settings, logs), the business
   * reference frame (structures, posts, competencies, templates), and validation.
   *
   * Note what this now includes that no single role held before: `user:create` *and*
   * `assignment:create` are both here, so one person can create an account and place it.
   * The earlier split existed to prevent exactly that. It was traded away deliberately for
   * a simpler four-role model; `/pending` still exists, but as a state rather than a
   * control.
   */
  ADMIN: [
  'assessment:read',
  'assignment:read',
  'audit_log:export',
  'audit_log:read',
  'competency:create',
  'competency:delete',
  'competency:read',
  'competency:update',
  'competency:validate',
  'dashboard:read',
  'document:create',
  'document:read',
  'document:update',
  'job:create',
  'job:delete',
  'job:read',
  'job:update',
  'job_description:create',
  'job_description:read',
  'job_description:update',
  'job_description:validate',
  'kaizen_action:create',
  'kaizen_action:read',
  'kaizen_action:update',
  'notification:read',
  'notification:update',
  'onboarding_instance:create',
  'onboarding_instance:read',
  'onboarding_instance:update',
  'onboarding_instance:validate',
  'onboarding_task:read',
  'onboarding_task:update',
  'onboarding_task:validate',
  'onboarding_template:create',
  'onboarding_template:read',
  'onboarding_template:update',
  'organization_unit:create',
  'organization_unit:delete',
  'organization_unit:read',
  'organization_unit:update',
  'position:create',
  'position:delete',
  'position:read',
  'position:update',
  'remark:read',
  'report:export',
  'report:read',
  'role:create',
  'role:delete',
  'role:read',
  'role:update',
  'setting:read',
  'setting:update',
  'survey:read',
  'training:create',
  'training:read',
  'training:update',
  'user:assign_role',
  'user:create',
  'user:delete',
  'user:read',
  'user:update',
    'assignment:create',
    'assignment:update',
  ],
  HR: [
    'organization_unit:read',
    'position:read',
    /*
     * HR places people; HR does not create or delete accounts. The account arrives from
     * SI (TECH_ADMIN) already existing but unplaced, and HR gives it a post — which is
     * what turns PENDING_ASSIGNMENT into ASSIGNED. Splitting the chain across two roles
     * is the point: neither can put a working account into the platform alone.
     */
    'assignment:read',
    'assignment:create',
    'assignment:update',
    /*
     * Deliberately NOT `user:read`: that permission gates `/admin`, the SI console with
     * its accounts, roles and audit trail. HR reads the people it may place through
     * `assignment:read` instead, which is narrower and is what `/hr` is gated on. Adding
     * `user:read` here to "let HR see names" silently handed HR the whole console.
     */
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
    'survey:read',
    'survey:create',
    'survey:update',
    'training:read',
  ],
  MANAGER: [
    'organization_unit:read',
    'position:read',
    'assignment:read',
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
    'survey:read',
    'training:read',
  ],
  EMPLOYEE: [
    'organization_unit:read',
    'position:read',
    'assignment:read',
    'job:read',
    'job_description:read',
    'competency:read',
    'assessment:read',
    'onboarding_instance:read',
    'onboarding_task:read',
    'onboarding_task:update',
    'remark:read',
    'remark:create',
    // Withdrawing one's own entry. Ownership is enforced at the target, so this never
    // means "delete anybody's remark" — a SELF-scoped assignment covers no other row.
    'remark:delete',
    'document:read',
    'dashboard:read',
    'notification:read',
    'notification:update',
    'survey:read',
    'survey:update',
    'training:read',
    'training:update',
  ],
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
