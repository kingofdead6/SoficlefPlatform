import 'server-only';

import type { AuthenticatedUser, RoleAssignment } from '@/domain/auth/authorization';
import { isRoleCode, ROLES } from '@/domain/auth/roles';

import { prisma } from '../db/client';

import { descendantUnitIds } from './organization-unit-repository';

/**
 * Loading a user means loading their rights: roles, and for each role the organizational
 * closure it applies to. The closure is resolved once here so `can()` stays a pure
 * function and a repository can turn a scope into an `IN (…)` predicate (ADR-020/021).
 */
export async function loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      locale: true,
      status: true,
      onboardingStartDate: true,
      userRoles: {
        select: {
          role: { select: { code: true } },
          scope: { select: { type: true, organizationUnitId: true } },
        },
      },
    },
  });
  if (!user) return null;

  // Each unit-scoped assignment needs its own closure: two managers may hold different
  // structures, and merging their subtrees would widen both.
  const rootUnitIds = [
    ...new Set(
      user.userRoles
        .map((assignment) => assignment.scope?.organizationUnitId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const closureByRoot = new Map<string, string[]>(
    await Promise.all(
      rootUnitIds.map(async (rootId) => [rootId, await descendantUnitIds([rootId])] as const),
    ),
  );

  const assignments: RoleAssignment[] = user.userRoles.flatMap((assignment) => {
    const code = assignment.role.code;
    if (!isRoleCode(code)) return [];

    if (!assignment.scope) {
      // No explicit scope row: the role's *natural* breadth applies — never a blanket
      // global one. An EMPLOYEE with no scope sees their own records; a MANAGER with no
      // unit attached covers nothing until one is, which is the safe reading of an
      // incomplete assignment.
      const natural = ROLES[code].naturalScope;
      return [
        {
          role: code,
          scope:
            natural === 'ORGANIZATION_UNIT'
              ? { kind: 'ORGANIZATION_UNIT' as const, organizationUnitIds: [] }
              : { kind: natural },
        },
      ];
    }

    if (assignment.scope.type === 'ORGANIZATION_UNIT' && assignment.scope.organizationUnitId) {
      const unitId = assignment.scope.organizationUnitId;
      return [
        {
          role: code,
          scope: {
            kind: 'ORGANIZATION_UNIT' as const,
            organizationUnitId: unitId,
            organizationUnitIds: closureByRoot.get(unitId) ?? [unitId],
          },
        },
      ];
    }

    return [{ role: code, scope: { kind: assignment.scope.type } }];
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    status: user.status,
    onboardingStartDate: user.onboardingStartDate,
    assignments,
  };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, displayName: true, passwordHash: true, status: true },
  });
}
