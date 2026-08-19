import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadJourney, loadJourneySummaries } from '@/application/onboarding/journey';
import { canOpen } from '@/application/navigation/build-navigation';
import { TaskRow } from '@/components/onboarding/task-row';
import {
  Card,
  CardBody,
  DataTable,
  EmptyState,
  KpiTile,
  ProgressBar,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The 30-day integration checklist (CDC v1 §3.7, CDC v0.1 §8).
 *
 * The prototype kept its ticks in `localStorage`, so they were per-browser and invisible
 * to HR. Here a tick is a row, scoped and audited, which is what makes the manager and
 * direction views of §8.1 possible at all.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/onboarding');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [journey, summaries] = await Promise.all([
    loadJourney(user).catch((error) => {
      console.error('Failed to load the onboarding journey:', error);
      return null;
    }),
    loadJourneySummaries(user).catch(() => []),
  ]);

  // Somebody with no journey of their own — an HR manager — still oversees other
  // people's, so the absence of a personal checklist is not an empty page.
  const others = summaries.filter((summary) => summary.subjectUserId !== user.id);

  if (!journey && others.length === 0) {
    return (
      <EmptyState
        title="Checklist 30 jours"
        description="Aucun parcours d'intégration ne vous est rattaché. Un parcours est créé par la DRH à partir d'un modèle."
      />
    );
  }

  return (
    <div className="space-y-10">
      {journey ? <OwnJourney journey={journey} user={user} locale={locale as Locale} /> : null}
      {others.length > 0 ? <Oversight rows={others} locale={locale as Locale} /> : null}
    </div>
  );
}

function OwnJourney({
  journey,
  user,
  locale,
}: {
  journey: NonNullable<Awaited<ReturnType<typeof loadJourney>>>;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  locale: Locale;
}) {
  const anchor = { ownerUserId: journey.subjectUserId };
  const canUpdate = can(user, 'update', 'onboarding_task', anchor);
  const canValidate = can(user, 'validate', 'onboarding_task', anchor);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          value={`${journey.progress.completed}/${journey.progress.total}`}
          label="Étapes réalisées"
        />
        <KpiTile value={journey.progress.validated} label="Étapes validées" />
        <KpiTile value={journey.progress.overdue} label="En retard" />
        <KpiTile
          value={formatDate(journey.startDate, locale)}
          label="Début du parcours"
          hint={journey.templateTitleFr}
        />
      </div>

      <ProgressBar
        value={journey.progress.percent}
        label="Progression du parcours"
        detail={`${journey.progress.completed}/${journey.progress.total}`}
      />

      <section>
        <SectionTitle lead="Cochez une étape lorsqu'elle est réalisée. Votre responsable la valide ensuite ; une étape bloquée est signalée à la DRH.">
          Jalons
        </SectionTitle>
        <ul className="space-y-2">
          {journey.tasks.map((task) => (
            <TaskRow
              key={task.milestoneId}
              instanceId={journey.instanceId}
              milestoneId={task.milestoneId}
              dayLabelFr={task.dayLabelFr}
              titleFr={task.titleFr}
              detailFr={task.detailFr}
              isRecommended={task.isRecommended}
              status={task.status}
              dueLabel={task.dueDate ? formatDate(task.dueDate, locale) : null}
              overdue={task.overdue}
              dueSoon={task.dueSoon}
              canUpdate={canUpdate}
              canValidate={canValidate}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Oversight({
  rows,
  locale,
}: {
  rows: Awaited<ReturnType<typeof loadJourneySummaries>>;
  locale: Locale;
}) {
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Collaborateur', render: (row) => row.subjectName },
    { key: 'template', header: 'Parcours', render: (row) => row.templateTitleFr },
    {
      key: 'start',
      header: 'Début',
      mono: true,
      render: (row) => formatDate(row.startDate, locale),
    },
    {
      key: 'progress',
      header: 'Progression',
      render: (row) => (
        <ProgressBar
          value={row.progress.percent}
          label={`Progression de ${row.subjectName}`}
          detail={`${row.progress.completed}/${row.progress.total}`}
          className="min-w-40"
        />
      ),
    },
    {
      key: 'alerts',
      header: 'Alertes',
      render: (row) =>
        row.progress.overdue === 0 && row.progress.blocked === 0 ? (
          <StatusBadge label="À jour" tone="green" />
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {row.progress.overdue > 0 ? (
              <StatusBadge label={`${row.progress.overdue} en retard`} tone="red" />
            ) : null}
            {row.progress.blocked > 0 ? (
              <StatusBadge label={`${row.progress.blocked} bloquée(s)`} tone="gold" />
            ) : null}
          </span>
        ),
    },
  ];

  return (
    <section>
      <SectionTitle lead="Les parcours d'intégration de votre périmètre.">
        Suivi des parcours
      </SectionTitle>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.instanceId}
        emptyLabel="Aucun parcours dans votre périmètre."
        caption="Progression des parcours d'intégration"
      />
      <Card className="mt-4">
        <CardBody>
          Une étape en retard n&apos;est pas calculée à l&apos;avance : elle est dérivée de
          l&apos;échéance et du statut à chaque affichage, donc elle ne peut pas rester affichée à
          tort après coup.
        </CardBody>
      </Card>
    </section>
  );
}
