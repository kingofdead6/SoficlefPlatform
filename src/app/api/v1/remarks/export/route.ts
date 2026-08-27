import { scopeFilterFor } from '@/domain/auth/authorization';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { audit } from '@/infrastructure/repositories/audit-repository';
import { requestContext, unauthorized, forbidden } from '@/infrastructure/http/route-handler';

/**
 * GET /api/v1/remarks/export — the remarks journal as a text file (CDC v1 §3.7).
 *
 * Exports respect the caller's scope, and leave an audit trail, because the content is
 * personal observations addressed to HR and the DG (CDC v0.1 §10, §15).
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const scope = scopeFilterFor(user, 'read', 'remark');
  if (scope.kind === 'none') return forbidden();

  /*
   * `units` fell through to `{}` — unfiltered — which is the opposite of what a unit
   * scope means. No role holds `remark:read` with a unit scope today, so nothing leaked;
   * it is fixed because the export is personal content and the next role added should not
   * have to notice.
   */
  const where =
    scope.kind === 'self'
      ? { authorId: user.id }
      : scope.kind === 'units'
        ? {
            author: {
              userRoles: {
                some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
              },
            },
          }
        : {};

  const remarks = await prisma.remark.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { displayName: true } } },
  });

  const stamp = (value: Date) =>
    new Intl.DateTimeFormat('fr-DZ', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Africa/Algiers',
      numberingSystem: 'latn',
    }).format(value);

  const lines = [
    'SOFICLEF — Remarques & Recommandations',
    `Exporté le ${stamp(new Date())} par ${user.displayName}`,
    '='.repeat(60),
    '',
    ...(remarks.length === 0
      ? ['Aucune remarque enregistrée.']
      : remarks.flatMap((remark, index) => [
          `${index + 1}. [${stamp(remark.createdAt)}] ${remark.author.displayName}`,
          remark.contentFr,
          '',
        ])),
  ];

  const context = requestContext(request);
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: 'report.exported',
    entityType: 'remark',
    entityId: null,
    before: null,
    after: { format: 'txt', count: remarks.length },
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="remarques-soficlef.txt"',
      // Personal content: never cached by an intermediary.
      'Cache-Control': 'no-store',
    },
  });
}
