import { z } from 'zod';

import { canAssignRole } from '../../domain/auth/authorization.js';
import { ROLE_CODES } from '../../domain/auth/roles.js';
import { prisma } from '../../infrastructure/db/client.js';
import { audit } from '../../infrastructure/repositories/audit-repository.js';

/**
 * Grants a role. Ported from SoficlefPlatform src/application/auth/assign-role.ts.
 *
 * The escalation guard is the point of this use case: holding `user:assign_role` does not
 * let you grant a role to yourself. The refused attempt is audited rather than merely
 * refused (Part 3 acceptance, ADR-020).
 */
export const assignRoleInput = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(ROLE_CODES),
  organizationUnitId: z.string().uuid().nullable().default(null),
});

export async function assignRole(actor, raw, context) {
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
    return { ok: false, reason: verdict.reason === 'self-assignment' ? 'self-assignment' : 'forbidden' };
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

    // Prisma cannot address a compound unique that contains a NULL, so look it up
    // explicitly rather than upsert. Re-granting an assignment already held is idempotent
    // and still audited.
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
        after: { userId, userEmail: target.email, roleCode, organizationUnitId },
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return { ok: true, userRoleId: userRole.id };
  });
}
