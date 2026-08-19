import { describe, expect, it } from 'vitest';

import { buildNavigation, canOpen } from '@/application/navigation/build-navigation';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
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

describe('navigation is seventeen routes in six groups', () => {
  it('declares exactly the seventeen routes of the specification', () => {
    // Fifteen content routes from the prototype, plus the role dashboard and the
    // administration section of CDC v0.1 §4.
    expect(NAV_ITEMS).toHaveLength(17);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(17);
  });

  it('does not include the AI assistant — phase 2 (ADR-003)', () => {
    // Matched on whole path segments: "/kaizen" contains the letters "ai".
    expect(NAV_ITEMS.some((item) => /^\/(assistant|ai|ia|chat)$/i.test(item.href))).toBe(false);
    expect(NAV_ITEMS.map((item) => item.id)).not.toContain('assistant');
  });

  it('shows every business entry to the business administrator', () => {
    const visible = idsOf(buildNavigation(user('BIZ_ADMIN_CE')));
    // Everything except the technical administration section, which is TECH_ADMIN's:
    // the business administrator manages the reference frame, not accounts and logs.
    expect(visible).toHaveLength(16);
    expect(visible).not.toContain('admin');
    expect(visible).toContain('dashboard');
  });

  it('reserves the administration section for the technical administrator', () => {
    expect(idsOf(buildNavigation(user('TECH_ADMIN')))).toContain('admin');
    for (const role of ['HEAD_CE', 'HR', 'MANAGER', 'EMPLOYEE', 'VIEWER'] as RoleCode[]) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      expect(idsOf(buildNavigation(account)), role).not.toContain('admin');
    }
  });
});

describe('entries a role cannot open are never sent', () => {
  it('hides Kaizen, the checklist and remarks from a VIEWER', () => {
    const visible = idsOf(buildNavigation(user('VIEWER')));
    expect(visible).not.toContain('kaizen');
    expect(visible).not.toContain('onboardingChecklist');
    expect(visible).not.toContain('remarks');
    expect(visible).toContain('organization');
  });

  it('drops a group entirely rather than leaving an empty heading', () => {
    const groups = buildNavigation(user('VIEWER'));
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
    const suspended = { ...user('BIZ_ADMIN_CE'), status: 'SUSPENDED' as const };
    expect(buildNavigation(suspended)).toEqual([]);
  });
});

describe('canOpen agrees with the menu', () => {
  it('is true for every visible entry and false for every hidden one', () => {
    for (const role of ['VIEWER', 'MANAGER', 'EMPLOYEE', 'HR', 'TECH_ADMIN'] as RoleCode[]) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      const visible = new Set(idsOf(buildNavigation(account)));

      for (const item of NAV_ITEMS) {
        expect(canOpen(account, item), `${role} · ${item.id}`).toBe(visible.has(item.id));
      }
    }
  });
});
