import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { loadJourney, type JourneyTask } from '@/application/onboarding/journey';
import { ProgressRing } from '@/components/me/progress-ring';
import { TaskRow } from '@/components/onboarding/task-row';
import {
  Card,
  CardBody,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatusBadge,
} from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The recruit's own roadmap (`/app/me/journey`), grouped by phase.
 *
 * Grouping matters more than it looks: a flat list of thirty tasks spanning three months
 * reads as a backlog, while three named phases read as a path with a beginning and an end.
 * CDC-2026 §2 names the phases, so the page uses them rather than inventing sections.
 */

const PHASES = [
  {
    key: 'PRE_ONBOARDING' as const,
    label: 'Avant l’arrivée',
    lead: 'Ce qui se prépare avant votre premier jour : poste de travail, dossier, premier contact.',
  },
  {
    key: 'DAY_ONE' as const,
    label: 'Premier jour',
    lead: 'Accueil, accès, équipement, signature du contrat.',
  },
  {
    key: 'PROBATION' as const,
    label: 'Période d’essai',
    lead: 'Suivi, formations, évaluations et points d’étape sur 90 jours.',
  },
];

const DEPARTMENT: Record<string, string> = {
  HR: 'Ressources humaines',
  IT: 'Informatique',
  HSE: 'HSE',
  QUALITY: 'Qualité',
  MANAGER: 'Votre responsable',
  EMPLOYEE: 'Vous',
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/journey');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const journey = await loadJourney(user).catch(() => null);

  if (!journey || journey.tasks.length === 0) {
    return (
      <EmptyState
        title="Mon parcours"
        description="Votre parcours d’intégration n’a pas encore été ouvert. Les RH s’en chargent avant votre arrivée."
      />
    );
  }

  const canUpdate = can(user, 'update', 'onboarding_task', { ownerUserId: user.id });
  const canValidate = can(user, 'validate', 'onboarding_task', { ownerUserId: user.id });

  /*
   * A task with no phase falls into the probation period rather than being dropped: the
   * seeded template predates the column, and silently hiding a task because a nullable
   * field is null is the worst possible reading of missing data.
   */
  const grouped = PHASES.map((phase) => ({
    ...phase,
    tasks: journey.tasks.filter((task) =>
      phase.key === 'PROBATION' ? task.phase === 'PROBATION' || task.phase === null : task.phase === phase.key,
    ),
  })).filter((phase) => phase.tasks.length > 0);

  const blocked = journey.tasks.filter((task) => task.status === 'BLOCKED');

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead={journey.templateTitleFr}>Mon parcours</SectionTitle>

        <Card>
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing percent={journey.progress.percent} />
            <div className="min-w-[200px] flex-1">
              <p className="text-text text-[13px] font-medium">
                {journey.progress.completed} étape{journey.progress.completed > 1 ? 's' : ''} terminée
                {journey.progress.completed > 1 ? 's' : ''} sur {journey.tasks.length}
              </p>
              <p className="text-text-muted mt-0.5 text-[12px]">
                Démarré le {formatDate(journey.startDate, locale as Locale)}
              </p>
              <ProgressBar
                className="mt-3"
                value={journey.progress.percent}
                label="Progression du parcours"
              />
            </div>
          </div>
        </Card>
      </section>

      {blocked.length > 0 ? (
        <section>
          <SectionTitle
            level={2}
            lead="Une étape bloquée attend quelqu’un d’autre. Le service responsable est indiqué : c’est à lui qu’il faut s’adresser."
          >
            Étapes bloquées
          </SectionTitle>
          <ul className="space-y-3">
            {blocked.map((task) => (
              <li key={task.milestoneId}>
                <Card accent="red">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-text text-[13px] font-medium">{task.titleFr}</span>
                    <StatusBadge
                      label={
                        task.ownerDepartment
                          ? `En attente · ${DEPARTMENT[task.ownerDepartment] ?? task.ownerDepartment}`
                          : 'Bloquée'
                      }
                      tone="red"
                    />
                  </div>
                  {task.noteFr ? <CardBody className="mt-1">{task.noteFr}</CardBody> : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grouped.map((phase) => (
        <section key={phase.key}>
          <SectionTitle level={2} lead={phase.lead}>
            {phase.label}
          </SectionTitle>

          <ul className="space-y-2">
            {/*
              * `TaskRow` renders the `<li>` itself, so it is used bare here. Wrapping it in
              * another `<li>` nested one inside the other, which is invalid HTML and
              * showed up as a hydration mismatch rather than as a layout bug.
              */}
            {phase.tasks.map((task: JourneyTask) => (
              <TaskRow
                key={task.milestoneId}
                instanceId={journey.instanceId}
                milestoneId={task.milestoneId}
                dayLabelFr={task.dayLabelFr}
                titleFr={task.titleFr}
                detailFr={task.detailFr}
                isRecommended={task.isRecommended}
                status={task.status}
                dueLabel={task.dueDate ? formatDate(task.dueDate, locale as Locale) : null}
                overdue={task.overdue}
                dueSoon={task.dueSoon}
                canUpdate={canUpdate}
                canValidate={canValidate}
                footer={
                  <div className="flex flex-wrap items-center gap-3">
                    {task.ownerDepartment ? (
                      <span className="text-text-dim text-[11px]">
                        Responsable · {DEPARTMENT[task.ownerDepartment] ?? task.ownerDepartment}
                      </span>
                    ) : null}
                    <Link
                      href={`/app/me/journey/${task.milestoneId}`}
                      className="text-red-strong text-[11px] font-medium"
                    >
                      Détail →
                    </Link>
                  </div>
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
