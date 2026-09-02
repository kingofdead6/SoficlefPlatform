import { assertCanAnyScope, scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * The employee directory, as HR reads it (CDC-2026 Module 1).
 * Ported from SoficlefPlatform src/application/hr/directory.ts.
 *
 * Scope is applied in the query (ADR-021): a unit-scoped HR account sees its own
 * structures and nothing else.
 */

function scopeWhere(user) {
  const scope = scopeFilterFor(user, 'read', 'assignment');
  if (scope.kind === 'none') return null;

  if (scope.kind === 'units') {
    return {
      assignments: {
        some: { endDate: null, position: { organizationUnitId: { in: scope.organizationUnitIds } } },
      },
    };
  }

  if (scope.kind === 'self') return { id: user.id };
  return {};
}

export async function listEmployees(user, filters = {}) {
  const scoped = scopeWhere(user);
  if (scoped === null) return [];

  const search = filters.search?.trim();

  const rows = await prisma.user.findMany({
    where: {
      ...scoped,
      ...(filters.lifecycleState ? { lifecycleState: filters.lifecycleState } : {}),
      ...(filters.managerId ? { managerId: filters.managerId } : {}),
      ...(filters.unitCode
        ? { assignments: { some: { endDate: null, position: { organizationUnit: { code: filters.unitCode } } } } }
        : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { positionTitleFr: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ lifecycleState: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      status: true,
      lifecycleState: true,
      hireDate: true,
      directionFr: true,
      serviceFr: true,
      positionTitleFr: true,
      manager: { select: { displayName: true } },
      assignments: {
        where: { endDate: null },
        select: { position: { select: { titleFr: true, organizationUnit: { select: { code: true } } } } },
        take: 1,
      },
      onboardingInstances: {
        where: { completedAt: null },
        select: {
          template: { select: { _count: { select: { milestones: true } } } },
          _count: { select: { taskCompletions: true } },
          taskCompletions: { where: { status: { in: ['DONE', 'VALIDATED'] } }, select: { id: true } },
        },
        take: 1,
      },
    },
  });

  return rows.map((row) => {
    const journey = row.onboardingInstances[0];
    const total = journey?.template._count.milestones ?? 0;
    const done = journey?.taskCompletions.length ?? 0;

    return {
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      lifecycleState: row.lifecycleState,
      hireDate: row.hireDate,
      directionFr: row.directionFr,
      serviceFr: row.serviceFr,
      positionTitleFr: row.positionTitleFr,
      managerName: row.manager?.displayName ?? null,
      positionFr: row.assignments[0]?.position.titleFr ?? null,
      unitCode: row.assignments[0]?.position.organizationUnit?.code ?? null,
      onboardingPercent: total === 0 ? null : Math.round((done / total) * 100),
    };
  });
}

export async function directoryFacets(user) {
  assertCanAnyScope(user, 'read', 'assignment');
  const scope = scopeFilterFor(user, 'read', 'organization_unit');

  const [units, managers] = await Promise.all([
    prisma.organizationUnit.findMany({
      where: { archivedAt: null, ...(scope.kind === 'units' ? { id: { in: scope.organizationUnitIds } } : {}) },
      select: { code: true, nameFr: true },
      orderBy: { code: 'asc' },
    }),
    prisma.user.findMany({
      where: { reports: { some: {} } },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    }),
  ]);

  return { units, managers };
}

/** Everything HR needs on one person. */
export async function loadEmployee(user, employeeId) {
  const scoped = scopeWhere(user);
  if (scoped === null) return null;

  return prisma.user.findFirst({
    where: { id: employeeId, ...scoped },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      locale: true,
      status: true,
      lifecycleState: true,
      hireDate: true,
      onboardingStartDate: true,
      directionFr: true,
      serviceFr: true,
      positionTitleFr: true,
      createdAt: true,
      manager: { select: { id: true, displayName: true, email: true } },
      userRoles: { select: { role: { select: { code: true } } } },
      assignments: {
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          position: {
            select: { id: true, titleFr: true, code: true, organizationUnit: { select: { code: true, nameFr: true } } },
          },
        },
      },
      onboardingInstances: {
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          startDate: true,
          completedAt: true,
          probationOutcome: true,
          template: { select: { titleFr: true, _count: { select: { milestones: true } } } },
          taskCompletions: { select: { status: true } },
          surveyRounds: {
            orderBy: { dayOffset: 'asc' },
            select: { dayOffset: true, dueDate: true, _count: { select: { responses: true } } },
          },
        },
      },
      personalFiles: {
        orderBy: { labelFr: 'asc' },
        select: { id: true, labelFr: true, status: true, submittedAt: true, noteFr: true },
      },
      trainingAttempts: {
        orderBy: { startedAt: 'desc' },
        select: { passed: true, score: true, startedAt: true, certifiedAt: true, module: { select: { titleFr: true, isMandatory: true } } },
      },
      documentAcknowledgements: {
        select: { acceptedAt: true, document: { select: { titleFr: true } } },
      },
    },
  });
}
