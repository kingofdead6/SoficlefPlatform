import { describe, expect, it } from 'vitest';

import { buildNavigation, canOpen } from '@/application/navigation/build-navigation';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { NAV_ITEMS } from '@/domain/navigation/navigation';
import type { RoleCode } from '@/domain/auth/roles';

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

describe('navigation is fifteen routes in four groups', () => {
  it('declares exactly the fifteen routes of the specification', () => {
    expect(NAV_ITEMS).toHaveLength(15);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(15);
  });

  it('does not include the AI assistant — phase 2 (ADR-003)', () => {
    // Matched on whole path segments: "/kaizen" contains the letters "ai".
    expect(NAV_ITEMS.some((item) => /^\/(assistant|ai|ia|chat)$/i.test(item.href))).toBe(false);
    expect(NAV_ITEMS.map((item) => item.id)).not.toContain('assistant');
  });

  it('shows every entry to the business administrator', () => {
    expect(idsOf(buildNavigation(user('BIZ_ADMIN_CE')))).toHaveLength(15);
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

  it('shows nothing at all to a suspended account', () => {
    const suspended = { ...user('BIZ_ADMIN_CE'), status: 'SUSPENDED' as const };
    expect(buildNavigation(suspended)).toEqual([]);
  });
});

describe('canOpen agrees with the menu', () => {
  it('is true for every visible entry and false for every hidden one', () => {
    for (const role of ['VIEWER', 'MANAGER', 'EMPLOYEE', 'HR'] as RoleCode[]) {
      const account = role === 'MANAGER' ? user(role, [FABRICATION]) : user(role);
      const visible = new Set(idsOf(buildNavigation(account)));

      for (const item of NAV_ITEMS) {
        expect(canOpen(account, item), `${role} · ${item.id}`).toBe(visible.has(item.id));
      }
    }
  });
});
