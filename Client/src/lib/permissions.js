/**
 * Client-side mirror of the domain permission model (server/src/domain/auth/*).
 * Used only to decide what to render (hide a nav link, disable a button) — never as
 * the security boundary. The Express API re-checks every request via the same
 * ROLE_PERMISSIONS table server-side; a hidden link here is a courtesy, not a control.
 */

export const ROLE_PERMISSIONS = {
  ADMIN: [
    'assessment:read', 'assignment:read', 'audit_log:export', 'audit_log:read',
    'competency:create', 'competency:delete', 'competency:read', 'competency:update', 'competency:validate',
    'dashboard:read', 'document:create', 'document:read', 'document:update',
    'job:create', 'job:delete', 'job:read', 'job:update',
    'job_description:create', 'job_description:read', 'job_description:update', 'job_description:validate',
    'kaizen_action:create', 'kaizen_action:read', 'kaizen_action:update',
    'notification:read', 'notification:update',
    'onboarding_instance:create', 'onboarding_instance:read', 'onboarding_instance:update', 'onboarding_instance:validate',
    'onboarding_task:read', 'onboarding_task:update', 'onboarding_task:validate',
    'onboarding_template:create', 'onboarding_template:read', 'onboarding_template:update',
    'organization_unit:create', 'organization_unit:delete', 'organization_unit:read', 'organization_unit:update',
    'position:create', 'position:delete', 'position:read', 'position:update',
    'remark:read', 'report:export', 'report:read',
    'role:create', 'role:delete', 'role:read', 'role:update',
    'setting:read', 'setting:update', 'survey:read',
    'training:create', 'training:read', 'training:update',
    'user:assign_role', 'user:create', 'user:delete', 'user:read', 'user:update',
    'assignment:create', 'assignment:update',
  ],
  HR: [
    'organization_unit:read', 'position:read', 'assignment:read', 'assignment:create', 'assignment:update',
    'job:read', 'job_description:read', 'job_description:validate', 'competency:read', 'assessment:read',
    'onboarding_template:read', 'onboarding_instance:read', 'onboarding_instance:create', 'onboarding_instance:update',
    'onboarding_task:read', 'onboarding_task:update', 'document:read', 'document:create',
    'remark:read', 'report:read', 'report:export', 'dashboard:read', 'notification:read', 'notification:update',
    'survey:read', 'survey:create', 'survey:update', 'training:read',
  ],
  MANAGER: [
    'organization_unit:read', 'position:read', 'assignment:read', 'job:read', 'job_description:read',
    'competency:read', 'assessment:read', 'assessment:assess', 'onboarding_instance:read', 'onboarding_instance:validate',
    'onboarding_task:read', 'onboarding_task:update', 'onboarding_task:validate',
    'kaizen_action:read', 'kaizen_action:update', 'document:read', 'report:read', 'dashboard:read',
    'notification:read', 'notification:update', 'survey:read', 'training:read',
    'quest:create', 'quest:read', 'quest:update',
  ],
  EMPLOYEE: [
    'organization_unit:read', 'position:read', 'assignment:read', 'job:read', 'job_description:read',
    'competency:read', 'assessment:read', 'onboarding_instance:read', 'onboarding_task:read', 'onboarding_task:update',
    'remark:read', 'remark:create', 'remark:delete', 'document:read', 'dashboard:read',
    'notification:read', 'notification:update', 'survey:read', 'survey:update', 'training:read', 'training:update',
    'quest:read', 'quest:update',
  ],
};

export function can(user, action, resource) {
  if (!user || user.status !== 'ACTIVE') return false;
  const required = `${resource}:${action}`;
  return (user.assignments ?? []).some((a) => ROLE_PERMISSIONS[a.role]?.includes(required));
}

export function hasRole(user, role) {
  return (user?.assignments ?? []).some((a) => a.role === role);
}
