import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadRecruit } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { loadJourney } from '@/application/onboarding/journey';
import { ProgressRing } from '@/components/me/progress-ring';
import { TaskRow } from '@/components/onboarding/task-row';
import {
  Card,
  CardBody,
  CardTitle,
  SectionTitle,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * One recruit's dossier (`/app/manager/recruits/[id]`).
 *
 * The manager's counterpart to HR's employee record, and deliberately not the same page:
 * HR needs the administrative history, a manager needs the week ahead. Survey answers
 * appear only as participation — a manager reading their own report's answers is exactly
 * what makes the next survey useless.
 */

const EVAL_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  DUE: { label: 'À faire', tone: 'red' },
  DRAFT: { label: 'Brouillon', tone: 'blue' },
  SUBMITTED: { label: 'Transmise', tone: 'green' },
};

const MILESTONE: Record<string, string> = {
  DAY_30: 'Point J+30',
  DAY_90: 'Point J+90',
  PROBATION_END: 'Fin de période d’essai',
};

const DEPARTMENT: Record<string, string> = {
  HR: 'Ressources humaines',
  IT: 'Informatique',
  HSE: 'HSE',
  QUALITY: 'Qualité',
  MANAGER: 'Responsable',
  EMPLOYEE: 'Collaborateur',
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/recruits');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const recruit = await loadRecruit(user, id).catch(() => null);
  if (!recruit) notFound();

  const instance = recruit.onboardingInstances[0] ?? null;

  // The journey loader applies the perimeter itself, so this cannot reach further than the
  // dossier already has.
  const journey = instance
    ? await loadJourney(user, { subjectUserId: recruit.id }).catch(() => null)
    : null;

  /*
   * Validation is checked against the unit the person actually sits in, not against a
   * null target: an unanchored target cannot be covered by a unit-scoped assignment, so
   * passing null here would have refused every manager on their own team.
   */
  const canValidate = can(user, 'validate', 'onboarding_task', {
    organizationUnitId: recruit.assignments[0]?.position.organizationUnitId ?? null,
  });

  const done = journey
    ? journey.tasks.filter((task) => task.status === 'DONE' || task.status === 'VALIDATED').length
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/manager/recruits" className="text-text-muted text-[12px]">
          ← Mes recrues
        </Link>
        <SectionTitle
          className="mt-2"
          lead={recruit.assignments[0]?.position.titleFr ?? 'Poste non renseigné'}
        >
          {recruit.displayName}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          {instance ? (
            <>
              <StatusBadge
                label={instance.completedAt ? 'Parcours terminé' : 'Intégration en cours'}
                tone={instance.completedAt ? 'neutral' : 'brand'}
              />
              <span className="text-text-muted font-mono text-[12px]">
                Démarré le {formatDate(instance.startDate, locale as Locale)}
              </span>
            </>
          ) : (
            <StatusBadge label="Aucun parcours" tone="neutral" />
          )}
        </div>
      </div>

      {journey ? (
        <Card>
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing percent={journey.progress.percent} />
            <div>
              <p className="text-text text-[13px] font-medium">
                {done} étape{done > 1 ? 's' : ''} sur {journey.tasks.length}
              </p>
              <p className="text-text-muted text-[12px]">{journey.templateTitleFr}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Tabs
        label="Dossier de la recrue"
        items={[
          {
            value: 'overview',
            label: 'Vue d’ensemble',
            content: (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardTitle>Coordonnées</CardTitle>
                  <CardBody className="mt-1">{recruit.email}</CardBody>
                  {recruit.phone ? (
                    <p className="text-text-dim font-mono text-[11px]">Poste {recruit.phone}</p>
                  ) : null}
                </Card>

                <Card>
                  <CardTitle>Rattachement</CardTitle>
                  <CardBody className="mt-1">
                    {recruit.assignments[0]?.position.organizationUnit
                      ? `${recruit.assignments[0].position.organizationUnit.nameFr} (${recruit.assignments[0].position.organizationUnit.code})`
                      : 'Non renseigné'}
                  </CardBody>
                </Card>

                <Card>
                  <CardTitle>Dates</CardTitle>
                  <CardBody className="mt-1">
                    {recruit.hireDate
                      ? `Embauché le ${formatDate(recruit.hireDate, locale as Locale)}`
                      : 'Date d’embauche non renseignée'}
                  </CardBody>
                </Card>

                <Card>
                  <CardTitle>Ajouter une tâche</CardTitle>
                  <CardBody className="mt-1">
                    Une consigne ponctuelle, en plus du parcours type : elle apparaît dans le
                    parcours du collaborateur.
                  </CardBody>
                  {instance ? (
                    <Link
                      href={`/app/manager/recruits/${recruit.id}/tasks/new`}
                      className="text-red-strong mt-2 inline-block text-[12px] font-medium"
                    >
                      Nouvelle tâche →
                    </Link>
                  ) : null}
                </Card>
              </div>
            ),
          },
          {
            value: 'path',
            label: 'Parcours',
            content: journey ? (
              <ul className="space-y-2">
                {journey.tasks.map((task) => (
                  <li key={task.milestoneId}>
                    <TaskRow
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
                      /*
                       * A manager validates rather than ticks off: marking somebody else's
                       * task as done on their behalf would misrepresent who did it.
                       */
                      canUpdate={false}
                      canValidate={canValidate}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <CardBody>Aucun parcours ouvert pour cette personne.</CardBody>
              </Card>
            ),
          },
          {
            value: 'tasks',
            label: 'Tâches ajoutées',
            content:
              !instance || instance.managerTasks.length === 0 ? (
                <Card>
                  <CardBody>
                    Aucune tâche ponctuelle. Le parcours type couvre le reste.
                  </CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {instance.managerTasks.map((task) => (
                    <li key={task.id}>
                      <Card>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-text text-[13px] font-medium">{task.titleFr}</p>
                            {task.detailFr ? (
                              <CardBody className="mt-1">{task.detailFr}</CardBody>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge
                              label={DEPARTMENT[task.ownerDepartment] ?? task.ownerDepartment}
                              tone="neutral"
                            />
                            {task.dueDate ? (
                              <span className="text-text-dim font-mono text-[11px]">
                                {formatDate(task.dueDate, locale as Locale)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            value: 'training',
            label: 'Formations',
            content:
              recruit.trainingAttempts.length === 0 ? (
                <Card>
                  <CardBody>Aucune tentative enregistrée.</CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {recruit.trainingAttempts.map((attempt, index) => (
                    <li key={`${attempt.module.titleFr}-${index}`}>
                      <Card>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-text text-[13px]">{attempt.module.titleFr}</p>
                            <p className="text-text-dim font-mono text-[11px]">
                              {formatDate(attempt.startedAt, locale as Locale)} · {attempt.score}%
                            </p>
                          </div>
                          <StatusBadge
                            label={attempt.passed ? 'Réussie' : 'Échouée'}
                            tone={attempt.passed ? 'green' : 'red'}
                          />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            value: 'surveys',
            label: 'Enquêtes',
            content: instance ? (
              <div className="space-y-2">
                <Card accent="red">
                  <CardBody>
                    Vous ne voyez pas les réponses : un collaborateur qui sait son responsable
                    lecteur de l’enquête n’y répond pas franchement, et l’enquête ne sert plus
                    à rien. Seule la participation est visible ici ; le score agrégé remonte
                    aux RH.
                  </CardBody>
                </Card>
                <ul className="space-y-2">
                  {instance.surveyRounds.map((round) => (
                    <li key={round.dayOffset}>
                      <Card>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-text text-[13px]">J+{round.dayOffset}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim font-mono text-[11px]">
                              Échéance {formatDate(round.dueDate, locale as Locale)}
                            </span>
                            <StatusBadge
                              label={round._count.responses > 0 ? 'Répondue' : 'En attente'}
                              tone={round._count.responses > 0 ? 'green' : 'neutral'}
                            />
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Card>
                <CardBody>Aucune enquête émise.</CardBody>
              </Card>
            ),
          },
          {
            value: 'evaluations',
            label: 'Évaluations',
            content:
              !instance || instance.evaluations.length === 0 ? (
                <Card>
                  <CardBody>
                    Aucune évaluation programmée. Elles sont créées avec le parcours.
                  </CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {instance.evaluations.map((evaluation) => {
                    const state = EVAL_STATUS[evaluation.status] ?? {
                      label: evaluation.status,
                      tone: 'neutral' as StatusTone,
                    };
                    return (
                      <li key={evaluation.id}>
                        <Card accent={evaluation.status === 'DUE' ? 'red' : undefined}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-text text-[13px] font-medium">
                                {MILESTONE[evaluation.milestone] ?? evaluation.milestone}
                              </p>
                              <p className="text-text-dim font-mono text-[11px]">
                                Échéance {formatDate(evaluation.dueDate, locale as Locale)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge label={state.label} tone={state.tone} />
                              <Link
                                href={`/app/manager/evaluations/${evaluation.id}`}
                                className="text-red-strong text-[12px] font-medium"
                              >
                                Ouvrir →
                              </Link>
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ),
          },
          {
            value: 'documents',
            label: 'Documents',
            content: (
              <div className="space-y-4">
                <Card>
                  <CardTitle>Documents acceptés</CardTitle>
                  {recruit.documentAcknowledgements.length === 0 ? (
                    <CardBody className="mt-1">Aucune acceptation enregistrée.</CardBody>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {recruit.documentAcknowledgements.map((ack, index) => (
                        <li key={index} className="text-text-muted text-[12px]">
                          {ack.document.titleFr} —{' '}
                          {formatDate(ack.acceptedAt, locale as Locale)}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <CardTitle>Pièces administratives</CardTitle>
                  {recruit.personalFiles.length === 0 ? (
                    <CardBody className="mt-1">Aucune pièce demandée.</CardBody>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {recruit.personalFiles.map((file) => (
                        <li key={file.id} className="text-text-muted text-[12px]">
                          {file.labelFr} — {file.status}
                        </li>
                      ))}
                    </ul>
                  )}
                  <CardBody className="mt-2">
                    Le contenu des pièces relève des RH ; vous en voyez l’état, pas le
                    document.
                  </CardBody>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
