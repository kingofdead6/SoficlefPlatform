import 'server-only';

import { z } from 'zod';

import { canAssignRole, type AuthenticatedUser } from '@/domain/auth/authorization';
import { ROLE_CODES } from '@/domain/auth/roles';
import { prisma } from '@/infrastructure/db/client';
import { audit } from '@/infrastructure/repositories/audit-repository';

export const assignRoleInput = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(ROLE_CODES),
  /** Required for a MANAGER assignment; a global role carries none. */
  organizationUnitId: z.string().uuid().nullable().default(null),
});

export type AssignRoleResult =
  | { ok: true; userRoleId: string }
  | { ok: false; reason: 'invalid-input' | 'forbidden' | 'self-assignment' | 'unknown-user' };

/**
 * Grants a role.
 *
 * The escalation guard is the point of this use case: holding `user:assign_role` does not
 * let you grant a role to yourself. A technical administrator who is also an employee
 * must not be able to widen their own access quietly, and the attempt is audited rather
 * than merely refused (Part 3 acceptance, ADR-020).
 */
export async function assignRole(
  actor: AuthenticatedUser,
  raw: unknown,
  context: { ip: string | null; userAgent: string | null },
): Promise<AssignRoleResult> {
  const parsed = assignRoleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid-input' };
  const { userId, roleCode, organizationUnitId } = parsed.data;

  const verdict = canAssignRole(actor, userId);
  if (!verdict.allowed) {
    await audit({
      actorId: actor.id,
      actorLabel: `${actor.displayName} <${actor.email}>`,
      action: 'user.role_assignment_denied',
      entityType: 'user_role',
      entityId: userId,
      before: null,
      after: { roleCode, organizationUnitId, reason: verdict.reason },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return {
      ok: false,
      reason: verdict.reason === 'self-assignment' ? 'self-assignment' : 'forbidden',
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
  if (!target) return { ok: false, reason: 'unknown-user' };

  const role = await prisma.role.findUnique({ where: { code: roleCode }, select: { id: true } });
  if (!role) return { ok: false, reason: 'invalid-input' };

  return prisma.$transaction(async (tx) => {
    const scope = organizationUnitId
      ? await tx.scope.upsert({
          where: { type_organizationUnitId: { type: 'ORGANIZATION_UNIT', organizationUnitId } },
          create: { type: 'ORGANIZATION_UNIT', organizationUnitId },
          update: {},
          select: { id: true },
        })
      : null;

    // Prisma cannot address a compound unique that contains a NULL, so the existing
    // assignment is looked up explicitly rather than upserted. Re-granting an assignment
    // someone already holds is idempotent and still audited.
    const existing = await tx.userRole.findFirst({
      where: { userId, roleId: role.id, scopeId: scope?.id ?? null },
      select: { id: true },
    });

    const userRole =
      existing ??
      (await tx.userRole.create({
        data: { userId, roleId: role.id, scopeId: scope?.id ?? null, grantedBy: actor.id },
        select: { id: true },
      }));

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorLabel: `${actor.displayName} <${actor.email}>`,
        action: 'user.role_assigned',
        entityType: 'user_role',
        entityId: userRole.id,
        after: {
          userId,
          userEmail: target.email,
          roleCode,
          organizationUnitId,
        },
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return { ok: true as const, userRoleId: userRole.id };
  });
}
