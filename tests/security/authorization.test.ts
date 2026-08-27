import { describe, expect, it } from 'vitest';

import {
  can,
  canAssignRole,
  scopeFilterFor,
  type AuthenticatedUser,
} from '@/domain/auth/authorization';
import { ACTIONS, RESOURCES, ROLE_PERMISSIONS, isMutating } from '@/domain/auth/permissions';
import { ROLE_CODES, type RoleCode } from '@/domain/auth/roles';

/**
 * The authorization rules, exhaustively. These are the acceptance criteria of Part 3
 * expressed as tests — the real deliverable — and they run without a database because
 * `can()` is a pure function (ADR-019, ADR-020).
 */

const FABRICATION = '11111111-1111-4111-8111-111111111111';
const COFFRE = '22222222-2222-4222-8222-222222222222';
const MAINTENANCE = '33333333-3333-4333-8333-333333333333';

function user(role: RoleCode, overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'user@soficlef.local',
    displayName: 'Test User',
    locale: 'fr',
    status: 'ACTIVE',
    lifecycleState: 'ASSIGNED',
    onboardingStartDate: null,
    assignments: [{ role, scope: { kind: 'GLOBAL' } }],
    ...overrides,
  };
}

const manager: AuthenticatedUser = user('MANAGER', {
  id: 'manager-1',
  assignments: [
    {
      role: 'MANAGER',
      // The head of Fabrication also covers the units beneath it.
      scope: {
        kind: 'ORGANIZATION_UNIT',
        organizationUnitId: FABRICATION,
        organizationUnitIds: [FABRICATION, COFFRE],
      },
    },
  ],
});

const employee: AuthenticatedUser = user('EMPLOYEE', {
  id: 'employee-1',
  assignments: [{ role: 'EMPLOYEE', scope: { kind: 'SELF' } }],
});

describe('MANAGER stays inside their scope', () => {
  it('reads a job in their own structure', () => {
    expect(can(manager, 'read', 'job', { organizationUnitId: FABRICATION })).toBe(true);
  });

  it('reads a job in a unit beneath their structure', () => {
    expect(can(manager, 'read', 'job', { organizationUnitId: COFFRE })).toBe(true);
  });

  it('cannot read a job in a sibling structure', () => {
    expect(can(manager, 'read', 'job', { organizationUnitId: MAINTENANCE })).toBe(false);
  });

  it('cannot write outside their scope', () => {
    expect(can(manager, 'update', 'onboarding_task', { organizationUnitId: MAINTENANCE })).toBe(
      false,
    );
  });

  it('cannot reach an unanchored resource with a unit-scoped role', () => {
    // No organizational anchor means no unit-scoped assignment can cover it. Refusing is
    // the safe reading; the caller must say which unit it is acting in.
    expect(can(manager, 'read', 'job')).toBe(false);
  });

  it('receives a unit predicate for the data layer, not "everything"', () => {
    expect(scopeFilterFor(manager, 'read', 'job')).toEqual({
      kind: 'units',
      organizationUnitIds: [FABRICATION, COFFRE],
    });
  });
});

describe('EMPLOYEE sees their own data and nothing else', () => {
  it('reads their own onboarding journey', () => {
    expect(can(employee, 'read', 'onboarding_instance', { ownerUserId: employee.id })).toBe(true);
  });

  it('cannot read another employee’s onboarding journey', () => {
    expect(can(employee, 'read', 'onboarding_instance', { ownerUserId: 'someone-else' })).toBe(
      false,
    );
  });

  it('cannot read another employee’s remarks', () => {
    expect(can(employee, 'read', 'remark', { ownerUserId: 'someone-else' })).toBe(false);
  });

  it('receives a self predicate for the data layer', () => {
    expect(scopeFilterFor(employee, 'read', 'onboarding_instance')).toEqual({
      kind: 'self',
      userId: employee.id,
    });
  });

  it('cannot validate anything, even their own tasks', () => {
    expect(can(employee, 'validate', 'onboarding_task', { ownerUserId: employee.id })).toBe(false);
  });
});

describe('EMPLOYEE mutates only its own rows', () => {
  /*
   * This replaces an exhaustive VIEWER read-only suite. VIEWER was one of four roles
   * folded into ADMIN, so "a role that can read everything and change nothing" no longer
   * exists in the model. The narrowest role is now EMPLOYEE, and the guarantee worth
   * pinning is different in kind: not "changes nothing" but "changes nothing that is not
   * theirs".
   */
  /*
   * A SELF scope, explicitly. The shared `user()` fixture defaults to GLOBAL, and a
   * globally-scoped employee legitimately *can* act on anybody's row — which is not what
   * an employee holds in practice, and would make this whole suite assert nothing.
   */
  const employee = user('EMPLOYEE', {
    assignments: [{ role: 'EMPLOYEE', scope: { kind: 'SELF' } }],
  });

  for (const resource of RESOURCES) {
    for (const action of ACTIONS.filter(isMutating)) {
      it(`refuses ${resource}:${action} on somebody else's row`, () => {
        // Another person's row, and a unit they hold no scope over.
        expect(can(employee, action, resource, { ownerUserId: 'somebody-else' })).toBe(false);
        expect(can(employee, action, resource, { organizationUnitId: FABRICATION })).toBe(false);
        // An unanchored target names nothing, so a SELF assignment cannot cover it.
        expect(can(employee, action, resource)).toBe(false);
      });
    }
  }

  it('reads the reference data every signed-in person needs', () => {
    expect(can(employee, 'read', 'dashboard', { ownerUserId: employee.id })).toBe(true);
    expect(can(employee, 'read', 'job', { ownerUserId: employee.id })).toBe(true);
    expect(can(employee, 'read', 'organization_unit', { ownerUserId: employee.id })).toBe(true);
  });

  it('holds no permission over accounts, roles, settings or the audit log', () => {
    for (const resource of ['user', 'role', 'setting', 'audit_log'] as const) {
      for (const action of ACTIONS) {
        expect(
          can(employee, action, resource, { ownerUserId: employee.id }),
          `${resource}:${action}`,
        ).toBe(false);
      }
    }
  });
});

describe('account status overrides every role', () => {
  for (const status of ['SUSPENDED', 'DISABLED'] as const) {
    it(`${status} account can do nothing, even with ADMIN`, () => {
      const disabled = user('ADMIN', { status });
      expect(can(disabled, 'read', 'user')).toBe(false);
      expect(can(disabled, 'update', 'setting')).toBe(false);
      expect(scopeFilterFor(disabled, 'read', 'user')).toEqual({ kind: 'none' });
    });
  }
});

describe('privilege escalation', () => {
  const admin = user('ADMIN', { id: 'admin-1' });

  it('lets a technical administrator grant a role to someone else', () => {
    expect(canAssignRole(admin, 'another-user')).toEqual({ allowed: true });
  });

  it('refuses self-assignment, even for a technical administrator', () => {
    expect(canAssignRole(admin, admin.id)).toEqual({
      allowed: false,
      reason: 'self-assignment',
    });
  });

  it('refuses role assignment for every other profile', () => {
    for (const role of ROLE_CODES.filter((code) => code !== 'ADMIN')) {
      expect(canAssignRole(user(role), 'another-user')).toEqual({
        allowed: false,
        reason: 'missing-permission',
      });
    }
  });

  it('refuses a manager trying to widen their own scope', () => {
    expect(canAssignRole(manager, manager.id).allowed).toBe(false);
    expect(can(manager, 'assign_role', 'user')).toBe(false);
  });
});

describe('no role is accidentally omnipotent', () => {
  it('only ADMIN may read the audit log or change settings', () => {
    for (const role of ROLE_CODES) {
      const expected = role === 'ADMIN';
      expect(can(user(role), 'read', 'audit_log')).toBe(expected);
      expect(can(user(role), 'update', 'setting')).toBe(expected);
    }
  });

  it('a user with no assignment can do nothing', () => {
    const orphan = user('EMPLOYEE', { assignments: [] });
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        expect(can(orphan, action, resource)).toBe(false);
      }
    }
  });

  it('every role holds at least one permission, so none is silently inert', () => {
    for (const role of ROLE_CODES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
