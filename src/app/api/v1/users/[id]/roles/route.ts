import { NextResponse } from 'next/server';

import { assignRole } from '@/application/auth/assign-role';
import { authenticated, badRequest, forbidden } from '@/infrastructure/http/route-handler';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/users/:id/roles
 *
 * Self-assignment is refused even for a technical administrator, and the attempt is
 * audited (Part 3 acceptance).
 */
export const POST = (request: Request, { params }: Params) =>
  authenticated(async ({ user, context }) => {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('expected a JSON body');
    }

    const result = await assignRole(
      user,
      { ...(body as Record<string, unknown>), userId: id },
      context,
    );

    if (result.ok)
      return NextResponse.json({ data: { userRoleId: result.userRoleId } }, { status: 201 });

    switch (result.reason) {
      case 'forbidden':
        return forbidden();
      case 'self-assignment':
        return NextResponse.json({ error: 'self_assignment_refused' }, { status: 403 });
      case 'unknown-user':
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      default:
        return badRequest();
    }
  })(request);
