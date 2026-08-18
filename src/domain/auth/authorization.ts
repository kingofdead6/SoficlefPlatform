import { permission, type Action, type Resource } from './permissions';
import { ROLE_PERMISSIONS } from './permissions';
import type { RoleCode, ScopeKind } from './roles';

/**
 * The single authorization decision point (ADR-020).
 *
 * Every route, server action and repository call goes through `can()`. There is no
 * second place where a permission is decided, which is what makes the rule auditable by
 * reading one file and testable exhaustively.
 *
 * Scope is resolved here, but *enforced* in the query layer (ADR-021): a repository
 * calls `scopeFilterFor()` and puts the result into the SQL predicate, so a manager's
 * query never returns rows they would then have to be prevented from seeing.
 */

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface AssignedScope {
  kind: ScopeKind;
  /** Set when kind is ORGANIZATION_UNIT. */
  organizationUnitId?: string;
  /**
   * The unit and its descendants, resolved once when the session is loaded. Keeping the
   * closure on the assignment lets `can()` stay a pure function and lets the repository
   * turn a scope into an `IN (…)` predicate without walking the tree per row.
   */
  organizationUnitIds?: string[];
}

export interface RoleAssignment {
  role: RoleCode;
  scope: AssignedScope;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  locale: string;
  status: UserStatus;
  /** Start of this person's onboarding journey, when they have one. */
  onboardingStartDate: Date | null;
  assignments: RoleAssignment[];
}

/**
 * What is being acted upon. Both fields are optional: a resource with no organizational
 * anchor and no owner (the permission catalogue itself, say) is covered by a global
 * scope only.
 */
export interface TargetScope {
  organizationUnitId?: string | null;
  ownerUserId?: string | null;
}

export function hasRole(user: AuthenticatedUser, role: RoleCode): boolean {
  return user.assignments.some((assignment) => assignment.role === role);
}

function scopeCovers(
  user: AuthenticatedUser,
  scope: AssignedScope,
  target: TargetScope | undefined,
): boolean {
  switch (scope.kind) {
    case 'GLOBAL':
      return true;

    case 'ORGANIZATION_UNIT': {
      // An unanchored target cannot be covered by a unit-scoped assignment: refusing is
      // the safe reading, and it forces callers to say which unit they are acting in.
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
 *
 * Returns false for a suspended or disabled account regardless of roles: status is
 * checked before permissions, so disabling an account is immediate and total.
 */
export function can(
  user: AuthenticatedUser,
  action: Action,
  resource: Resource,
  target?: TargetScope,
): boolean {
  if (user.status !== 'ACTIVE') return false;

  const required = permission(resource, action);

  return user.assignments.some((assignment) => {
    const granted = ROLE_PERMISSIONS[assignment.role];
    if (!granted.includes(required)) return false;
    return scopeCovers(user, assignment.scope, target);
  });
}

/** `can()`, but throwing. Route handlers and server actions use this one. */
export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(
    readonly action: Action,
    readonly resource: Resource,
  ) {
    super(`Forbidden: ${resource}:${action}`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(
  user: AuthenticatedUser,
  action: Action,
  resource: Resource,
  target?: TargetScope,
): void {
  if (!can(user, action, resource, target)) throw new ForbiddenError(action, resource);
}

/**
 * The predicate a repository must apply for this user, action and resource.
 *
 *  - `{ kind: 'all' }`        — a global assignment grants the permission everywhere.
 *  - `{ kind: 'units', ... }` — restrict to these organization units.
 *  - `{ kind: 'self' }`       — restrict to rows owned by this user.
 *  - `{ kind: 'none' }`       — the user holds the permission nowhere; return no rows.
 *
 * A repository that receives `none` must return an empty result rather than throw: a
 * list endpoint showing nothing is correct, a 500 is not.
 */
export type ScopeFilter =
  | { kind: 'all' }
  | { kind: 'units'; organizationUnitIds: string[] }
  | { kind: 'self'; userId: string }
  | { kind: 'none' };

export function scopeFilterFor(
  user: AuthenticatedUser,
  action: Action,
  resource: Resource,
): ScopeFilter {
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
          (scope) =>
            scope.organizationUnitIds ??
            (scope.organizationUnitId ? [scope.organizationUnitId] : []),
        ),
    ),
  ];
  if (unitIds.length > 0) return { kind: 'units', organizationUnitIds: unitIds };

  if (scopes.some((scope) => scope.kind === 'SELF')) return { kind: 'self', userId: user.id };

  return { kind: 'none' };
}

/**
 * Privilege-escalation guard, applied on top of `can()` for role assignment.
 *
 * Holding `user:assign_role` is not enough to grant a role to yourself: an administrator
 * who is also, say, an EMPLOYEE must not be able to widen their own access silently. The
 * attempt is rejected here and audited by the caller (Part 3 acceptance).
 */
export function canAssignRole(
  actor: AuthenticatedUser,
  targetUserId: string,
): { allowed: boolean; reason?: 'missing-permission' | 'self-assignment' } {
  if (!can(actor, 'assign_role', 'user')) return { allowed: false, reason: 'missing-permission' };
  if (actor.id === targetUserId) return { allowed: false, reason: 'self-assignment' };
  return { allowed: true };
}
