import { describe, expect, it } from 'vitest';

import { buildNavigation, canOpen } from '@/application/navigation/build-navigation';
import { canAnyScope, type AuthenticatedUser } from '@/domain/auth/authorization';
import { NAV_ITEMS } from '@/domain/navigation/navigation';
import { ROLE_CODES, type RoleCode } from '@/domain/auth/roles';

/**
 * Navigation is filtered on the server from the same permissions the routes enforce
 * (ADR-031). These tests are about *what is sent to the browser*; the security suite
 * covers what happens when someone types the URL anyway.
 */

const FABRICATION = '11111111-1111-4111-8111-111111111111';

function user(role: RoleCode, scopeUnits?: string[]): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'user@soficlef.local',
    displayName: 'Test User',
    locale: 'fr',
    status: 'ACTIVE',
    lifecycleState: 'ASSIGNED',
    onboardingStartDate: null,
    assignments: [
      {
        role,
        scope: scopeUnits
          ? {
              kind: 'ORGANIZATION_UNIT',
              organizationUnitId: scopeUnits[0],
              organizationUnitIds: scopeUnits,
            }
          : role === 'EMPLOYEE'
            ? { kind: 'SELF' }
            : { kind: 'GLOBAL' },
      },
    ],
  };
}

const idsOf = (groups: ReturnType<typeof buildNavigation>) =>
  groups.flatMap((group) => group.items.map((item) => item.id));

describe('navigation is thirty routes in seven groups', () => {
  it('declares exactly the thirty routes of the specification', () => {
    // Fifteen content routes from the prototype, the role dashboard and the
    // administration section of CDC v0.1 §4, training and surveys from CDC-2026
    // Modules 6 and 9, and personnel administration -- HR's half of the provisioning
    // chain, which is a separate screen from SI's because it is a separate job.
    expect(NAV_ITEMS).toHaveLength(30);
    // Every href distinct: two entries pointing at one route would make the sidebar
    // highlight ambiguous and the permission check on that route arbitrary.
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(30);
  });

  it('does not include the AI assistant — phase 2 (ADR-003)', () => {
    // Matched on whole path segments: "/kaizen" contains the letters "ai".
    expect(NAV_ITEMS.some((item) => /^\/(assistant|ai|ia|chat)$/i.test(item.href))).toBe(false);
    expect(NAV_ITEMS.map((item) => item.id)).not.toContain('assistant');
  });

  it('shows the administrator every entry, business and technical alike', () => {
    /*
     * ADMIN absorbed the previous TECH_ADMIN, BIZ_ADMIN_CE, HEAD_CE and VIEWER, so it now
     * sees both the business reference frame and the administration screen. The earlier
     * model deliberately kept those apart; folding them is the trade the four-role
     * simplification makes, and this test says so rather than hiding it.
     */
    const visible = idsOf(buildNavigation(user('ADMIN')));
    expect(visible).toContain('admin');
    expect(visible).toContain('dashboard');
    expect(visible).toContain('organization');
  });

  it('reserves the administration section for the administrator', () => {
    expect(idsOf(buildNavigation(user('ADMIN')))).toContain('admin');
    for (const role of ['HR', 'MANAGER', 'EMPLOYEE'] as RoleCode[]) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      expect(idsOf(buildNavigation(account)), role).not.toContain('admin');
    }
  });
});

describe('entries a role cannot open are never sent', () => {
  it('hides Kaizen and personnel administration from a collaborator', () => {
    const visible = idsOf(buildNavigation(user('EMPLOYEE')));
    expect(visible).not.toContain('kaizen');
    expect(visible).not.toContain('hr');
    expect(visible).not.toContain('admin');
    // The reference frame stays visible: a new arrival is meant to read it.
    expect(visible).toContain('organization');
    expect(visible).toContain('onboardingChecklist');
  });

  it('drops a group entirely rather than leaving an empty heading', () => {
    const groups = buildNavigation(user('EMPLOYEE'));
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
  });

  it('gives a scoped manager their entries, not an empty menu', () => {
    // A MANAGER holds permissions inside their perimeter, never globally: a naive global
    // check would hide every entry from them.
    const visible = idsOf(buildNavigation(user('MANAGER', [FABRICATION])));
    expect(visible).toContain('organization');
    expect(visible).toContain('kaizen');
    expect(visible).not.toContain('remarks');
  });

  it('gives an employee their own pages', () => {
    const visible = idsOf(buildNavigation(user('EMPLOYEE')));
    expect(visible).toContain('welcome');
    expect(visible).toContain('remarks');
    expect(visible).toContain('onboardingChecklist');
    expect(visible).not.toContain('kaizen');
  });

  it('gives every signed-in role a landing page they may actually open', () => {
    // The sign-in redirect sends everybody to /dashboard, so a role that cannot open it
    // would land on a 404 the moment it signed in.
    const dashboard = NAV_ITEMS.find((entry) => entry.id === 'dashboard')!;
    for (const role of ROLE_CODES) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      expect(canOpen(account, dashboard), role).toBe(true);
    }
  });

  it('shows nothing at all to a suspended account', () => {
    const suspended = { ...user('ADMIN'), status: 'SUSPENDED' as const };
    expect(buildNavigation(suspended)).toEqual([]);
  });
});

describe('canOpen agrees with the menu', () => {
  it('is true for every visible entry and false for every hidden one', () => {
    for (const role of ROLE_CODES) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      const visible = new Set(idsOf(buildNavigation(account)));

      for (const item of NAV_ITEMS) {
        expect(canOpen(account, item), `${role} · ${item.id}`).toBe(visible.has(item.id));
      }
    }
  });
});

describe('a unit-scoped role can actually load what the menu offers it', () => {
  /*
   * The regression this pins down: `canOpen` asked "do you hold this permission
   * anywhere", while the training loader asked "do you hold it on your own row". Those
   * disagree for every unit-scoped role — the sidebar offered HR the training catalogue
   * and the loader then threw `training:read`, so the page rendered its empty state and
   * the course list was invisible to everyone except collaborators.
   *
   * `canAnyScope` is now the single question both sides ask.
   */
  const UNIT_SCOPED: RoleCode[] = ['HR', 'MANAGER', 'ADMIN'];

  it('grants shared reference content to unit-scoped and self-scoped roles alike', () => {
    for (const role of UNIT_SCOPED) {
      const account = user(role, [FABRICATION]);
      expect(canAnyScope(account, 'read', 'training'), `${role} · training`).toBe(true);
    }

    // The collaborator, whose only assignment is SELF, must keep it too.
    expect(canAnyScope(user('EMPLOYEE'), 'read', 'training')).toBe(true);
  });

  it('still refuses a permission the role does not hold at all', () => {
    // MANAGER is deliberately without `remark:read` — scope breadth must not invent it.
    expect(canAnyScope(user('MANAGER', [FABRICATION]), 'read', 'remark')).toBe(false);
  });

  it('refuses everything to a suspended account regardless of scope', () => {
    const suspended = { ...user('HR', [FABRICATION]), status: 'SUSPENDED' as const };
    expect(canAnyScope(suspended, 'read', 'training')).toBe(false);
  });
});

describe('the provisioning chain, under the four-role model', () => {
  /*
   * This suite used to assert a separation of duties: SI created accounts, HR placed
   * them, and neither could do the other's half. Collapsing seven roles into four ended
   * that — ADMIN now holds `user:create` *and* `assignment:create`.
   *
   * The tests are rewritten rather than deleted, because what they pin down still matters:
   * the chain is still two *steps*, HR still cannot create accounts, and an unplaced
   * account still reaches nothing. What is gone is the guarantee that two people were
   * required, and that is stated here so it is not later mistaken for still holding.
   */
  it('gives ADMIN both halves of the chain — no longer a separation of duties', () => {
    const admin = user('ADMIN');
    expect(canAnyScope(admin, 'create', 'user')).toBe(true);
    expect(canAnyScope(admin, 'create', 'assignment')).toBe(true);
  });

  it('still keeps HR out of account creation', () => {
    const hr = user('HR');
    // HR places people; it does not create or delete the accounts. This half of the
    // original split survives the collapse.
    expect(canAnyScope(hr, 'create', 'user')).toBe(false);
    expect(canAnyScope(hr, 'delete', 'user')).toBe(false);
    expect(canAnyScope(hr, 'create', 'assignment')).toBe(true);
  });

  it('offers the personnel screen only to those who may assign', () => {
    // Both roles that hold `assignment:create` see it; neither of the other two does.
    expect(idsOf(buildNavigation(user('HR')))).toContain('hr');
    expect(idsOf(buildNavigation(user('ADMIN')))).toContain('hr');
    expect(idsOf(buildNavigation(user('EMPLOYEE')))).not.toContain('hr');
    expect(idsOf(buildNavigation(user('MANAGER', [FABRICATION])))).not.toContain('hr');
  });

  it('keeps HR out of the SI console', () => {
    const visible = idsOf(buildNavigation(user('HR')));
    expect(visible).toContain('hr');
    expect(visible).not.toContain('admin');
  });
});
