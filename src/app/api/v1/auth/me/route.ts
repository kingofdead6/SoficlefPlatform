import { NextResponse } from 'next/server';

import { authenticated } from '@/infrastructure/http/route-handler';

/** GET /api/v1/auth/me — the signed-in user and the rights they actually hold. */
export const GET = authenticated(async ({ user }) =>
  NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    assignments: user.assignments.map((assignment) => ({
      role: assignment.role,
      scope: assignment.scope.kind,
      organizationUnitId: assignment.scope.organizationUnitId ?? null,
    })),
  }),
);
