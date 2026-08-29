import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Evaluations owed and given (`/app/manager/evaluations`).
 *
 * Ordered by due date rather than by person, because the question a manager opens this
 * page with is "what do I owe this week", not "how is each of my people doing" — that is
 * the dashboard.
 */

const MILESTONE: Record<string, string> = {
  DAY_30: 'Point J+30',
  DAY_90: 'Point J+90',
  PROBATION_END: 'Fin de période d’essai',
};

const RECOMMENDATION: Record<string, string> = {
  CONFIRM: 'Confirmer',
  EXTEND: 'Prolonger',
  TERMINATE: 'Ne pas confirmer',
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/evaluations');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  /*
   * The perimeter comes from the recruit list rather than being re-derived: one place
   * decides who a manager may see, and this page reads that decision instead of making a
   * second one that could drift from it.
   */
  const recruits = await listRecruits(user, { includeArchived: true }).catch(() => []);
  const instanceIds = recruits.map((recruit) => recruit.instanceId);

  const evaluations =
    instanceIds.length === 0
      ? []
      : await prisma.evaluation
          .findMany({
            where: { instanceId: { in: instanceIds } },
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
            select: {
              id: true,
              milestone: true,
              dueDate: true,
              status: true,
              recommendation: true,
              submittedAt: true,
              subject: { select: { id: true, displayName: true } },
            },
          })
          .catch(() => []);

  const pending = evaluations.filter((evaluation) => evaluation.status !== 'SUBMITTED');
  const submitted = evaluations.filter((evaluation) => evaluation.status === 'SUBMITTED');

  const now = new Date();
  const late = pending.filter((evaluation) => evaluation.dueDate < now).length;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les points d’étape que vous devez aux RH, par échéance. Une évaluation transmise ne peut plus être modifiée.">
          Évaluations
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={pending.length} label="À faire" />
          <KpiTile value={late} label="En retard" hint={late > 0 ? 'À traiter' : undefined} />
          <KpiTile value={submitted.length} label="Transmises" />
        </div>
      </section>

      <section>
        <SectionTitle level={2}>À faire</SectionTitle>

        {pending.length === 0 ? (
          <Card>
            <CardBody>Aucune évaluation en attente.</CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {pending.map((evaluation) => {
              const overdue = evaluation.dueDate < now;

              return (
                <li key={evaluation.id}>
                  <Card accent={overdue ? 'red' : undefined}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>{evaluation.subject.displayName}</CardTitle>
                        <CardBody className="mt-1">
                          {MILESTONE[evaluation.milestone] ?? evaluation.milestone}
                        </CardBody>
                        <p className="text-text-dim mt-1 font-mono text-[11px]">
                          Échéance {formatDate(evaluation.dueDate, locale as Locale)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusBadge
                          label={
                            overdue
                              ? 'En retard'
                              : evaluation.status === 'DRAFT'
                                ? 'Brouillon'
                                : 'À faire'
                          }
                          tone={overdue ? 'red' : evaluation.status === 'DRAFT' ? 'blue' : 'neutral'}
                        />
                        <div className="flex gap-3">
                          <Link
                            href={`/app/manager/interviews/${evaluation.id}`}
                            className="text-text-muted text-[12px]"
                          >
                            Préparer
                          </Link>
                          <Link
                            href={`/app/manager/evaluations/${evaluation.id}`}
                            className="text-red-strong text-[12px] font-medium"
                          >
                            Remplir →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {submitted.length > 0 ? (
        <section>
          <SectionTitle level={2}>Transmises</SectionTitle>
          <ul className="space-y-2">
            {submitted.map((evaluation) => (
              <li key={evaluation.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-text text-[13px] font-medium">
                        {evaluation.subject.displayName}
                      </p>
                      <p className="text-text-muted text-[12px]">
                        {MILESTONE[evaluation.milestone] ?? evaluation.milestone}
                        {evaluation.submittedAt
                          ? ` · transmise le ${formatDate(evaluation.submittedAt, locale as Locale)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {evaluation.recommendation ? (
                        <StatusBadge
                          label={
                            RECOMMENDATION[evaluation.recommendation] ?? evaluation.recommendation
                          }
                          tone={
                            evaluation.recommendation === 'CONFIRM'
                              ? 'green'
                              : evaluation.recommendation === 'EXTEND'
                                ? 'blue'
                                : 'red'
                          }
                        />
                      ) : null}
                      <Link
                        href={`/app/manager/evaluations/${evaluation.id}`}
                        className="text-red-strong text-[12px] font-medium"
                      >
                        Consulter →
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
