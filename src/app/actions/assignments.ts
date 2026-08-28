'use server';

import { revalidatePath } from 'next/cache';

import {
  assignToPosition,
  endAssignment,
  type AssignmentView,
} from '@/application/organization/assignments';
import type { ActionResult } from '@/application/shared/mutate';

/**
 * The provisioning chain's second step, as server actions.
 *
 * Authorization is not repeated here: `mutate()` authenticates, re-validates and
 * authorizes against the resolved target before running anything (ADR-020). These
 * functions exist to translate a `FormData` into that call and to invalidate the pages
 * whose content just changed.
 */

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export async function assignUser(
  _previous: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ assignmentId: string }>> {
  const result = await assignToPosition({
    userId: text(formData, 'userId'),
    positionId: text(formData, 'positionId'),
    startDate: text(formData, 'startDate'),
    managerOverrideId: text(formData, 'managerOverrideId'),
    templateId: text(formData, 'templateId'),
  });

  if (result.ok) {
    // The person moves off the pending queue, onto the chart, and into a journey.
    for (const path of [
      '/app/hr',
      '/app/hr/employees',
      '/app/hr/employees/unassigned',
      '/app/hr/organigram',
      '/organization',
      '/management',
      '/onboarding',
      '/admin',
    ]) {
      revalidatePath(`/[locale]${path}`, 'page');
    }
  }

  return result;
}

export async function closeAssignment(
  _previous: ActionResult<{ assignmentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ assignmentId: string }>> {
  const result = await endAssignment({
    assignmentId: text(formData, 'assignmentId'),
    endDate: text(formData, 'endDate'),
  });

  if (result.ok) {
    for (const path of [
      '/app/hr',
      '/app/hr/employees',
      '/app/hr/organigram',
      '/organization',
      '/management',
      '/admin',
    ]) {
      revalidatePath(`/[locale]${path}`, 'page');
    }
  }

  return result;
}

export type { AssignmentView };
