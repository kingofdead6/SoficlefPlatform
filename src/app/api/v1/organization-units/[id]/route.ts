import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  findOrganizationUnitForUser,
  updateOrganizationUnit,
} from '@/infrastructure/repositories/organization-unit-repository';
import { authenticated, badRequest, notFound } from '@/infrastructure/http/route-handler';

const patchInput = z.object({
  nameFr: z.string().trim().min(1).optional(),
  nameAr: z.string().trim().min(1).nullable().optional(),
  nameEn: z.string().trim().min(1).nullable().optional(),
  type: z.string().trim().min(1).optional(),
});

/** In Next 16 dynamic params arrive as a promise. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/organization-units/:id
 *
 * Out of scope reads as "not found", never as "forbidden": a direct URL must not reveal
 * that a structure exists but is out of reach.
 */
export const GET = (request: Request, { params }: Params) =>
  authenticated(async ({ user }) => {
    const { id } = await params;
    const unit = await findOrganizationUnitForUser(user, id);
    return unit ? NextResponse.json({ data: unit }) : notFound();
  })(request);

/** PATCH /api/v1/organization-units/:id */
export const PATCH = (request: Request, { params }: Params) =>
  authenticated(async ({ user, context }) => {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('expected a JSON body');
    }

    const parsed = patchInput.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues);

    // assertCan() inside the repository turns into a 403 via the wrapper.
    const updated = await updateOrganizationUnit(user, id, parsed.data, context);
    return NextResponse.json({ data: updated });
  })(request);
