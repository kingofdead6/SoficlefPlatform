import { NextResponse } from 'next/server';

import { listOrganizationUnits } from '@/infrastructure/repositories/organization-unit-repository';
import { authenticated } from '@/infrastructure/http/route-handler';

/**
 * GET /api/v1/organization-units
 *
 * The scope predicate is applied in the query (ADR-021): a manager receives their own
 * structures and nothing else, so this handler has no filtering of its own to forget.
 */
export const GET = authenticated(async ({ user }) => {
  const units = await listOrganizationUnits(user);
  return NextResponse.json({ data: units });
});
