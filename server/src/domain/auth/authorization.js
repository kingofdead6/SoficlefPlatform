import { permission, ROLE_PERMISSIONS } from './permissions.js';

/**
 * The single authorization decision point.
 * Ported faithfully from SoficlefPlatform src/domain/auth/authorization.ts.
 *
 * Every route and controller goes through `can()` / `assertCan()`. Scope is resolved
 * here but enforced in the Prisma query via `scopeFilterFor()`.
 */

function scopeCovers(user, scope, target) {
  switch (scope.kind) {
    case 'GLOBAL':
      return true;

    case 'ORGANIZATION_UNIT': {
      if (!target?.organizationUnitId) return false;
      const covered =
        scope.organizationUnitIds ?? (scope.organizationUnitId ? [scope.organizationUnitId] : []);
      return covered.includes(target.organizationUnitId);
    }

    case 'SELF':
      return target?.ownerUserId === user.id;

    default:
      return false;
  }
}

/**
 * May this user perform this action on this resource, within this scope?
 * Returns false for a suspended/disabled account regardless of roles.
 */
export function can(user, action, resource, target) {
  if (user.status !== 'ACTIVE') return false;

  const required = permission(resource, action);

  return user.assignments.some((assignment) => {
    const granted = ROLE_PERMISSIONS[assignment.role];
    if (!granted.includes(required)) return false;
    return scopeCovers(user, assignment.scope, target);
  });
}

export class ForbiddenError extends Error {
  constructor(action, resource) {
    super(`Forbidden: ${resource}:${action}`);
    this.name = 'ForbiddenError';
    this.status = 403;
    this.action = action;
    this.resource = resource;
  }
}

export function assertCan(user, action, resource, target) {
  if (!can(user, action, resource, target)) throw new ForbiddenError(action, resource);
}

/**
 * May this user perform this action on this resource *anywhere* they hold it?
 * For shared reference content (training catalogue, competency frame) with no owner.
 */
export function canAnyScope(user, action, resource) {
  if (user.status !== 'ACTIVE') return false;
  const required = permission(resource, action);
  return user.assignments.some((assignment) => ROLE_PERMISSIONS[assignment.role].includes(required));
}

export function assertCanAnyScope(user, action, resource) {
  if (!canAnyScope(user, action, resource)) throw new ForbiddenError(action, resource);
}

/**
 * The predicate a repository/query must apply for this user, action and resource.
 *  - { kind: 'all' }                       — global assignment grants everywhere.
 *  - { kind: 'units', organizationUnitIds } — restrict to these units.
 *  - { kind: 'self', userId }              — restrict to rows owned by this user.
 *  - { kind: 'none' }                      — user holds the permission nowhere.
 */
export function scopeFilterFor(user, action, resource) {
  if (user.status !== 'ACTIVE') return { kind: 'none' };

  const required = permission(resource, action);
  const relevant = user.assignments.filter((assignment) =>
    ROLE_PERMISSIONS[assignment.role].includes(required),
  );
  if (relevant.length === 0) return { kind: 'none' };

  const scopes = relevant.map((assignment) => assignment.scope);
  if (scopes.some((scope) => scope.kind === 'GLOBAL')) return { kind: 'all' };

  const unitIds = [
    ...new Set(
      scopes
        .filter((scope) => scope.kind === 'ORGANIZATION_UNIT')
        .flatMap(
          (scope) => scope.organizationUnitIds ?? (scope.organizationUnitId ? [scope.organizationUnitId] : []),
        ),
    ),
  ];
  if (unitIds.length > 0) return { kind: 'units', organizationUnitIds: unitIds };

  if (scopes.some((scope) => scope.kind === 'SELF')) return { kind: 'self', userId: user.id };

  return { kind: 'none' };
}

/**
 * Privilege-escalation guard for role assignment: holding `user:assign_role` is not
 * enough to grant a role to yourself.
 */
export function canAssignRole(actor, targetUserId) {
  if (!can(actor, 'assign_role', 'user')) return { allowed: false, reason: 'missing-permission' };
  if (actor.id === targetUserId) return { allowed: false, reason: 'self-assignment' };
  return { allowed: true };
}

export function hasRole(user, role) {
  return user.assignments.some((assignment) => assignment.role === role);
}
