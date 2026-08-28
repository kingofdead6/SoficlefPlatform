import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadEmployee } from '@/application/hr/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  CardTitle,
  ProgressBar,
  SectionTitle,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * One person's full record (`/app/hr/employees/[id]`).
 *
 * Tabs rather than one long page: HR opens this for one reason at a time — checking a
 * path, chasing a document, reading survey participation — and a page that answers all six
 * at once answers none of them quickly.
 */

const FILE_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  REQUESTED: { label: 'À fournir', tone: 'red' },
  SUBMITTED: { label: 'Transmise', tone: 'blue' },
  ACCEPTED: { label: 'Validée', tone: 'green' },
  REJECTED: { label: 'À refaire', tone: 'red' },
};

const OUTCOME: Record<string, { label: string; tone: StatusTone }> = {
  ONGOING: { label: 'En cours', tone: 'blue' },
  CONFIRMED: { label: 'Confirmée', tone: 'green' },
  EXTENDED: { label: 'Prolongée', tone: 'neutral' },
  TERMINATED: { label: 'Non confirmée', tone: 'red' },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/employees');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const person = await loadEmployee(user, id).catch(() => null);
  // Out of perimeter is not found, never found-and-refused (ADR-021).
  if (!person) notFound();

  const current = person.assignments.find((assignment) => assignment.endDate === null) ?? null;
  const journey = person.onboardingInstances[0] ?? null;

  const journeyDone = journey
    ? journey.taskCompletions.filter(
        (task) => task.status === 'DONE' || task.status === 'VALIDATED',
      ).length
    : 0;
  const journeyTotal = journey?.template._count.milestones ?? 0;

  const lifecycle =
    person.lifecycleState === 'ASSIGNED'
      ? { label: 'En poste', tone: 'green' as StatusTone }
      : person.lifecycleState === 'PENDING_ASSIGNMENT'
        ? { label: 'Sans poste', tone: 'red' as StatusTone }
        : { label: 'Archivé', tone: 'neutral' as StatusTone };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/hr/employees" className="text-text-muted text-[12px]">
          ← Collaborateurs
        </Link>
        <SectionTitle
          className="mt-2"
          lead={current ? current.position.titleFr : 'Aucun poste attribué.'}
        >
          {person.displayName}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={lifecycle.label} tone={lifecycle.tone} />
          {person.status !== 'ACTIVE' ? (
            <StatusBadge
              label={person.status === 'SUSPENDED' ? 'Suspendu' : 'Désactivé'}
              tone="red"
            />
          ) : null}
          {person.userRoles.map((assignment) => (
            <StatusBadge key={assignment.role.code} label={assignment.role.code} tone="neutral" />
          ))}
        </div>
      </div>

      <Tabs
        label="Dossier du collaborateur"
        items={[
          {
            value: 'overview',
            label: 'Vue d’ensemble',
            content: (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardTitle>Coordonnées</CardTitle>
                  <CardBody className="mt-1">{person.email}</CardBody>
                  {person.phone ? (
                    <p className="text-text-dim font-mono text-[11px]">Poste {person.phone}</p>
                  ) : null}
                </Card>

                <Card>
                  <CardTitle>Rattachement</CardTitle>
                  <CardBody className="mt-1">
                    {current?.position.organizationUnit
                      ? `${current.position.organizationUnit.nameFr} (${current.position.organizationUnit.code})`
                      : (person.directionFr ?? 'Non renseigné')}
                  </CardBody>
                  {person.manager ? (
                    <p className="text-text-dim text-[11px]">
                      Responsable : {person.manager.displayName}
                    </p>
                  ) : null}
                </Card>

                <Card>
                  <CardTitle>Dates</CardTitle>
                  <CardBody className="mt-1">
                    {person.hireDate
                      ? `Embauché le ${formatDate(person.hireDate, locale as Locale)}`
                      : 'Date d’embauche non renseignée'}
                  </CardBody>
                  {person.onboardingStartDate ? (
                    <p className="text-text-dim text-[11px]">
                      Parcours démarré le{' '}
                      {formatDate(person.onboardingStartDate, locale as Locale)}
                    </p>
                  ) : null}
                </Card>

                <Card>
                  <CardTitle>Compte</CardTitle>
                  <CardBody className="mt-1">
                    Créé le {formatDate(person.createdAt, locale as Locale)}
                  </CardBody>
                  {person.lifecycleState === 'PENDING_ASSIGNMENT' ? (
                    <Link
                      href="/app/hr/employees/unassigned"
                      className="text-red-strong mt-2 inline-block text-[12px] font-medium"
                    >
                      Affecter à un poste →
                    </Link>
                  ) : null}
                </Card>
              </div>
            ),
          },
          {
            value: 'journey',
            label: 'Parcours',
            content: journey ? (
              <Card>
                <CardTitle>{journey.template.titleFr}</CardTitle>
                <CardBody className="mt-1">
                  {journeyDone} étape{journeyDone > 1 ? 's' : ''} sur {journeyTotal} · démarré le{' '}
                  {formatDate(journey.startDate, locale as Locale)}
                </CardBody>
                <ProgressBar
                  className="mt-3"
                  value={journeyTotal === 0 ? 0 : Math.round((journeyDone / journeyTotal) * 100)}
                  label="Avancement du parcours"
                />
                <div className="mt-3">
                  <StatusBadge
                    label={OUTCOME[journey.probationOutcome]?.label ?? journey.probationOutcome}
                    tone={OUTCOME[journey.probationOutcome]?.tone ?? 'neutral'}
                  />
                </div>
              </Card>
            ) : (
              <Card>
                <CardBody>Aucun parcours d’intégration ouvert pour cette personne.</CardBody>
              </Card>
            ),
          },
          {
            value: 'files',
            label: 'Pièces',
            content:
              person.personalFiles.length === 0 ? (
                <Card>
                  <CardBody>Aucune pièce administrative demandée.</CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {person.personalFiles.map((file) => {
                    const state = FILE_STATUS[file.status] ?? {
                      label: file.status,
                      tone: 'neutral' as StatusTone,
                    };
                    return (
                      <li key={file.id}>
                        <Card>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-text text-[13px]">{file.labelFr}</p>
                              {file.noteFr ? (
                                <p className="text-text-dim text-[11px]">{file.noteFr}</p>
                              ) : null}
                            </div>
                            <StatusBadge label={state.label} tone={state.tone} />
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ),
          },
          {
            value: 'training',
            label: 'Formations',
            content:
              person.trainingAttempts.length === 0 ? (
                <Card>
                  <CardBody>Aucune tentative enregistrée.</CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {person.trainingAttempts.map((attempt, index) => (
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
            content: journey ? (
              <div className="space-y-2">
                <p className="text-text-muted text-[12px]">
                  Les réponses individuelles ne sont pas consultables : c’est ce qui rend une
                  réponse honnête possible. Seule la participation est visible ici.
                </p>
                <ul className="space-y-2">
                  {journey.surveyRounds.map((round) => (
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
            value: 'assignments',
            label: 'Affectations',
            content:
              person.assignments.length === 0 ? (
                <Card>
                  <CardBody>Aucune affectation enregistrée.</CardBody>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {person.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      <Card accent={assignment.endDate === null ? 'red' : undefined}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-text text-[13px] font-medium">
                              {assignment.position.titleFr}
                            </p>
                            <p className="text-text-dim font-mono text-[11px]">
                              {formatDate(assignment.startDate, locale as Locale)}
                              {assignment.endDate
                                ? ` → ${formatDate(assignment.endDate, locale as Locale)}`
                                : ' → en cours'}
                            </p>
                          </div>
                          <StatusBadge
                            label={assignment.endDate === null ? 'En cours' : 'Close'}
                            tone={assignment.endDate === null ? 'green' : 'neutral'}
                          />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  );
}
