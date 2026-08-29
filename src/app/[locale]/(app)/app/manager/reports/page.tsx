import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
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
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The manager's own indicators (`/app/manager/reports`).
 *
 * Scoped to their tree, and computed from the same rows the dashboard shows — a KPI that
 * disagrees with the list it summarises is worse than no KPI, because both look right in
 * isolation.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/reports');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [all, satisfaction] = await Promise.all([
    listRecruits(user, { includeArchived: true }).catch(() => []),
    loadSatisfaction(user).catch(() => null),
  ]);

  const running = all.filter((recruit) => !recruit.completed);
  const finished = all.filter((recruit) => recruit.completed);

  const averagePercent =
    running.length === 0
      ? null
      : Math.round(running.reduce((sum, recruit) => sum + recruit.percent, 0) / running.length);

  /*
   * Deliberately not reported here.
   *
   * `dayNumber` counts days since the journey started, which for a finished journey is
   * time *elapsed*, not time *taken* — somebody who completed everything at D+40 and was
   * last looked at on D+200 would report 200. The honest figure needs `completedAt`, which
   * the HR analytics page already uses; duplicating a wrong version of it here would give
   * two screens that disagree.
   */

  const columns: Column<(typeof all)[number]>[] = [
    {
      key: 'person',
      header: 'Collaborateur',
      render: (row) => (
        <Link href={`/app/manager/recruits/${row.userId}`} className="text-red-strong">
          {row.displayName}
        </Link>
      ),
    },
    {
      key: 'start',
      header: 'Démarré',
      align: 'end',
      mono: true,
      render: (row) => formatDate(row.startDate, locale as Locale),
    },
    {
      key: 'progress',
      header: 'Avancement',
      align: 'end',
      mono: true,
      render: (row) => `${row.percent}%`,
    },
    {
      key: 'late',
      header: 'Retards',
      align: 'end',
      mono: true,
      render: (row) => (row.overdue === 0 ? '—' : row.overdue),
    },
  ];

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Vos indicateurs, restreints à votre périmètre. Ils sont recalculés à chaque affichage depuis les parcours eux-mêmes.">
          Indicateurs
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={running.length} label="Intégrations en cours" />
          <KpiTile
            value={averagePercent === null ? '—' : `${averagePercent}%`}
            label="Avancement moyen"
          />
          <KpiTile
            value={finished.length}
            label="Parcours terminés"
            hint="Durée moyenne : voir le reporting RH"
          />
          <KpiTile
            value={all.filter((recruit) => recruit.overdue > 0).length}
            label="Avec du retard"
          />
        </div>

        {averagePercent !== null ? (
          <ProgressBar
            className="mt-4"
            value={averagePercent}
            label="Avancement moyen des intégrations en cours"
          />
        ) : null}
      </section>

      <section>
        <SectionTitle level={2}>Satisfaction</SectionTitle>
        <Card>
          <CardTitle>
            {satisfaction?.score === null || !satisfaction
              ? 'Pas encore de réponse'
              : `${satisfaction.score}% sur votre périmètre`}
          </CardTitle>
          <CardBody className="mt-1">
            Score agrégé des enquêtes J+7 à J+90. Les réponses individuelles ne vous sont pas
            accessibles : un collaborateur qui sait son responsable lecteur n’y répond pas
            franchement, et l’indicateur ne mesure alors plus rien.
          </CardBody>
          {satisfaction?.score != null ? (
            <ProgressBar
              className="mt-3"
              value={satisfaction.score}
              label="Satisfaction de votre périmètre"
            />
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle level={2}>Détail par personne</SectionTitle>
        {all.length === 0 ? (
          <Card>
            <CardBody>Aucune intégration dans votre périmètre.</CardBody>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            rows={all}
            getRowKey={(row) => row.instanceId}
            emptyLabel="Aucune intégration."
            caption="Intégrations de votre périmètre"
          />
        )}
      </section>
    </div>
  );
}
