import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadHrDashboard } from '@/application/hr/dashboard';
import { canOpen } from '@/application/navigation/build-navigation';
import { loadSatisfaction } from '@/application/survey/rounds';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  KpiTile,
  ProgressBar,
  SectionTitle,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * The Module 10 indicators (`/app/hr/analytics`).
 *
 * Every figure here is computed from rows, never stored: a KPI cached at write time drifts
 * the moment somebody corrects a date, and a drifting KPI is worse than none because it is
 * still believed.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/analytics');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [hr, satisfaction, completed, departures, headcount, byUnit] = await Promise.all([
    loadHrDashboard(user),
    loadSatisfaction(user).catch(() => null),

    // Finished journeys, for the average duration.
    prisma.onboardingInstance
      .findMany({
        where: { completedAt: { not: null } },
        select: { startDate: true, completedAt: true },
      })
      .catch(() => []),

    /*
     * Turnover over six months: assignments closed in the window. Counting closed
     * assignments rather than deleted accounts is the point of never hard-deleting them —
     * somebody who left in March is still countable in September.
     */
    prisma.assignment
      .count({ where: { endDate: { gte: sixMonthsAgo, not: null } } })
      .catch(() => 0),

    prisma.user.count({ where: { status: 'ACTIVE', lifecycleState: 'ASSIGNED' } }).catch(() => 0),

    prisma.organizationUnit
      .findMany({
        where: { archivedAt: null },
        select: {
          code: true,
          nameFr: true,
          positions: {
            where: { archivedAt: null },
            select: {
              _count: { select: { assignments: true } },
              assignments: { where: { endDate: null }, select: { id: true } },
            },
          },
        },
        orderBy: { code: 'asc' },
      })
      .catch(() => []),
  ]);

  const averageDays =
    completed.length === 0
      ? null
      : Math.round(
          completed.reduce(
            (sum, instance) =>
              sum +
              (instance.completedAt!.getTime() - instance.startDate.getTime()) / 86_400_000,
            0,
          ) / completed.length,
        );

  const turnoverPercent = headcount === 0 ? null : Math.round((departures / headcount) * 100);

  const unitRows = byUnit.map((unit) => ({
    code: unit.code,
    nameFr: unit.nameFr,
    positions: unit.positions.length,
    filled: unit.positions.filter((position) => position.assignments.length > 0).length,
  }));

  const columns: Column<(typeof unitRows)[number]>[] = [
    { key: 'unit', header: 'Structure', render: (row) => `${row.code} — ${row.nameFr}` },
    { key: 'positions', header: 'Postes', align: 'end', mono: true, render: (row) => row.positions },
    { key: 'filled', header: 'Pourvus', align: 'end', mono: true, render: (row) => row.filled },
    {
      key: 'rate',
      header: 'Taux',
      align: 'end',
      mono: true,
      render: (row) =>
        row.positions === 0 ? '—' : `${Math.round((row.filled / row.positions) * 100)}%`,
    },
  ];

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les indicateurs du module 10, recalculés à chaque affichage depuis les données elles-mêmes.">
          Indicateurs & reporting
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            value={averageDays === null ? '—' : `${averageDays} j`}
            label="Durée moyenne d’intégration"
            hint={`${completed.length} parcours terminé${completed.length > 1 ? 's' : ''}`}
          />
          <KpiTile
            value={hr.completionPercent === null ? '—' : `${hr.completionPercent}%`}
            label="Taux de complétion"
          />
          <KpiTile
            value={satisfaction?.score === null || !satisfaction ? '—' : `${satisfaction.score}%`}
            label="Satisfaction"
            hint="Objectif ≥ 85%"
          />
          <KpiTile
            value={turnoverPercent === null ? '—' : `${turnoverPercent}%`}
            label="Turnover 6 mois"
            hint={`${departures} départ${departures > 1 ? 's' : ''} sur ${headcount}`}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Intégrations</CardTitle>
          <CardBody className="mt-1">
            {hr.onboardingsInProgress} en cours, {hr.onboardingsCompleted} terminées,{' '}
            {hr.onboardingsLate} en retard.
          </CardBody>
          {hr.completionPercent !== null ? (
            <ProgressBar
              className="mt-3"
              value={hr.completionPercent}
              label="Avancement moyen des parcours en cours"
            />
          ) : null}
        </Card>

        <Card>
          <CardTitle>Taux de réponse aux enquêtes</CardTitle>
          <CardBody className="mt-1">
            {satisfaction?.responseRate === null || !satisfaction
              ? 'Aucune enquête ouverte.'
              : `${satisfaction.responseRate}% des enquêtes ouvertes ont reçu une réponse.`}
          </CardBody>
          {satisfaction?.responseRate != null ? (
            <ProgressBar
              className="mt-3"
              value={satisfaction.responseRate}
              label="Taux de réponse"
            />
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle level={2} lead="Le taux de postes pourvus par structure : là où il baisse, le recrutement est en retard sur l’organisation.">
          Par structure
        </SectionTitle>
        <DataTable
          columns={columns}
          rows={unitRows}
          getRowKey={(row) => row.code}
          emptyLabel="Aucune structure."
          caption="Postes pourvus par structure"
        />
      </section>

      <Card>
        <CardTitle>Comparaison de périodes</CardTitle>
        <CardBody className="mt-1">
          Le turnover est calculé sur six mois glissants. Une comparaison période à période
          demande un historique plus long que celui dont dispose la plateforme aujourd’hui —
          la donnée s’accumule, l’écran viendra quand elle sera lisible.
        </CardBody>
        <Link href="/app/hr/analytics/reports" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
          Générateur de rapports →
        </Link>
      </Card>
    </div>
  );
}
