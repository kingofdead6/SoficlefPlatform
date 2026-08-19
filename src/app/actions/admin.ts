'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

import { assignRole } from '@/application/auth/assign-role';
import { mutate, type ActionResult } from '@/application/shared/mutate';
import { ROLE_CODES } from '@/domain/auth/roles';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The administration screens' mutations (CDC v0.1 §11).
 *
 * Role assignment delegates to the existing `assignRole` use case rather than
 * reimplementing it, because that is where the privilege-escalation guard lives: holding
 * `user:assign_role` never lets an administrator widen their own access, and the refused
 * attempt is audited (Part 3 acceptance).
 */

const AssignRole = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(ROLE_CODES),
  organizationUnitId: z.string().uuid().nullable(),
});

export async function grantRole(
  _previous: ActionResult<{ userRoleId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ userRoleId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'unauthenticated' };

  const unit = formData.get('organizationUnitId');
  const parsed = AssignRole.safeParse({
    userId: formData.get('userId'),
    roleCode: formData.get('roleCode'),
    organizationUnitId: typeof unit === 'string' && unit.length > 0 ? unit : null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');

  const result = await assignRole(user, parsed.data, {
    ip: forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip'),
    userAgent: headerList.get('user-agent'),
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === 'unknown-user' ? 'not-found' : 'forbidden',
      message:
        result.reason === 'self-assignment'
          ? "Un administrateur ne peut pas s'attribuer un rôle à lui-même."
          : undefined,
    };
  }

  revalidatePath('/[locale]/(app)/admin', 'page');
  return { ok: true, data: { userRoleId: result.userRoleId } };
}

const SetStatus = z.object({
  userId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
});

/**
 * Suspending or re-enabling an account.
 *
 * `can()` refuses status changes on oneself before the query runs, so an administrator
 * cannot lock themselves out of the platform they administer.
 */
export async function setUserStatus(
  _previous: ActionResult<{ status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const result = await mutate(
    { userId: formData.get('userId'), status: formData.get('status') },
    {
      schema: SetStatus,
      requires: { resource: 'user', action: 'update' },
      run: async (value, context) => {
        if (value.userId === context.user.id) {
          throw Object.assign(new Error('cannot change your own status'), { status: 409 });
        }

        const before = await context.tx.user.findUnique({
          where: { id: value.userId },
          select: { id: true, email: true, status: true },
        });
        if (!before) throw Object.assign(new Error('unknown user'), { status: 404 });

        const after = await context.tx.user.update({
          where: { id: value.userId },
          data: { status: value.status },
          select: { id: true, email: true, status: true },
        });

        // A suspended account must lose its sessions immediately, otherwise the person
        // stays signed in until their cookie happens to expire.
        if (value.status !== 'ACTIVE') {
          await context.tx.session.deleteMany({ where: { userId: value.userId } });
        }

        await context.audit({
          action: 'user.status_changed',
          entityType: 'user',
          entityId: after.id,
          before,
          after,
        });

        return { status: after.status };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/admin', 'page');
  return result;
}
