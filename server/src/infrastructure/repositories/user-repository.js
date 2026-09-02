import { isRoleCode, ROLES } from '../../domain/auth/roles.js';
import { prisma } from '../db/client.js';
import { descendantUnitIds } from './organization-unit-repository.js';

/**
 * Loading a user means loading their rights: roles, and for each role the organizational
 * closure it applies to. Resolved once so `can()` stays a pure function.
 */
export async function loadAuthenticatedUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      locale: true,
      status: true,
      lifecycleState: true,
      onboardingStartDate: true,
      // Carried on the session user so the shell and the New Hire portal's team page can
      // render the caller's own photo without a second round trip (route guide §2.1).
      avatarUrl: true,
      // The caller's own department, carried for the same reason: the document library
      // filters department-targeted documents against these two fields on every list, and
      // re-reading the user row per request would be a round trip for a value the session
      // already had to load.
      directionFr: true,
      serviceFr: true,
      userRoles: {
        select: {
          role: { select: { code: true } },
          scope: { select: { type: true, organizationUnitId: true } },
        },
      },
    },
  });
  if (!user) return null;

  const rootUnitIds = [
    ...new Set(
      user.userRoles.map((assignment) => assignment.scope?.organizationUnitId).filter(Boolean),
    ),
  ];
  const closureByRoot = new Map(
    await Promise.all(
      rootUnitIds.map(async (rootId) => [rootId, await descendantUnitIds([rootId])]),
    ),
  );

  const assignments = user.userRoles.flatMap((assignment) => {
    const code = assignment.role.code;
    if (!isRoleCode(code)) return [];

    if (!assignment.scope) {
      const natural = ROLES[code].naturalScope;
      return [
        {
          role: code,
          scope:
            natural === 'ORGANIZATION_UNIT'
              ? { kind: 'ORGANIZATION_UNIT', organizationUnitIds: [] }
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
            kind: 'ORGANIZATION_UNIT',
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
    lifecycleState: user.lifecycleState,
    onboardingStartDate: user.onboardingStartDate,
    avatarUrl: user.avatarUrl,
    directionFr: user.directionFr,
    serviceFr: user.serviceFr,
    assignments,
  };
}

export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, displayName: true, passwordHash: true, status: true },
  });
}
