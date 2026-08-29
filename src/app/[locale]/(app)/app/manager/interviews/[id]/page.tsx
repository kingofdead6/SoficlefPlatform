import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * A discussion canvas for the milestone interview (`/app/manager/interviews/[id]`).
 *
 * The specification asks Agent 4 to generate this from progress, quiz scores and survey
 * answers. Two of those three it can have; the third it must not — a canvas quoting the
 * recruit's survey answers hands the manager exactly what the anonymity promise says they
 * will never see.
 *
 * So the canvas is assembled from the facts rather than written by a model: what happened,
 * what stalled, what was learned, and the questions those facts raise. No provider is
 * called (ADR-003), and the page prints as-is.
 */

const MILESTONE: Record<string, { label: string; focusFr: string[] }> = {
  DAY_30: {
    label: 'Point J+30',
    focusFr: [
      'Le poste correspond-il à ce qui avait été décrit ?',
      'L’accueil et le matériel ont-ils suivi ?',
      'Qu’est-ce qui reste flou après un mois ?',
    ],
  },
  DAY_90: {
    label: 'Point J+90',
    focusFr: [
      'L’autonomie est-elle acquise sur les gestes courants ?',
      'Quelles compétences manquent encore, et comment les acquérir ?',
      'Le rythme et la charge sont-ils tenables ?',
    ],
  },
  PROBATION_END: {
    label: 'Fin de période d’essai',
    focusFr: [
      'La période d’essai est-elle concluante, et sur quels faits ?',
      'Quels objectifs pour les six prochains mois ?',
      'Que faudrait-il changer dans l’intégration du prochain arrivant ?',
    ],
  },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/evaluations');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const recruits = await listRecruits(user, { includeArchived: true }).catch(() => []);
  const instanceIds = new Set(recruits.map((candidate) => candidate.instanceId));

  const evaluation = await prisma.evaluation
    .findUnique({
      where: { id },
      select: {
        id: true,
        instanceId: true,
        milestone: true,
        dueDate: true,
        subject: {
          select: {
            id: true,
            displayName: true,
            trainingAttempts: {
              orderBy: { startedAt: 'desc' },
              select: {
                passed: true,
                score: true,
                module: { select: { titleFr: true, isMandatory: true } },
              },
            },
          },
        },
        instance: {
          select: {
            startDate: true,
            taskCompletions: {
              select: {
                status: true,
                noteFr: true,
                milestone: { select: { titleFr: true, dayLabelFr: true } },
              },
            },
            managerTasks: { select: { titleFr: true, status: true } },
          },
        },
      },
    })
    .catch(() => null);

  if (!evaluation || !instanceIds.has(evaluation.instanceId)) notFound();

  const recruit = recruits.find((candidate) => candidate.instanceId === evaluation.instanceId);
  const milestone = MILESTONE[evaluation.milestone] ?? {
    label: evaluation.milestone,
    focusFr: [],
  };

  const blocked = evaluation.instance.taskCompletions.filter(
    (task) => task.status === 'BLOCKED',
  );
  const failed = evaluation.subject.trainingAttempts.filter((attempt) => !attempt.passed);
  const passed = evaluation.subject.trainingAttempts.filter((attempt) => attempt.passed);

  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <Link href="/app/manager/evaluations" className="text-text-muted text-[12px]">
          ← Évaluations
        </Link>
      </div>

      <div>
        <SectionTitle
          lead={`${milestone.label} · ${formatDate(evaluation.dueDate, locale as Locale)}`}
        >
          Préparation — {evaluation.subject.displayName}
        </SectionTitle>
        <p className="text-text-muted text-[12px]">
          Trame de discussion, à partir de ce que la plateforme sait. Imprimable telle
          quelle.
        </p>
      </div>

      <Card>
        <CardTitle>Où en est le parcours</CardTitle>
        {recruit ? (
          <CardBody className="mt-1">
            Jour {recruit.dayNumber} · {recruit.percent}% ({recruit.done}/{recruit.total}{' '}
            étapes)
            {recruit.overdue > 0
              ? ` · ${recruit.overdue} étape(s) au-delà de leur échéance`
              : ' · aucune étape en retard'}
          </CardBody>
        ) : (
          <CardBody className="mt-1">Parcours introuvable.</CardBody>
        )}
      </Card>

      {blocked.length > 0 ? (
        <Card accent="red">
          <CardTitle>Ce qui a bloqué</CardTitle>
          <ul className="mt-2 space-y-1">
            {blocked.map((task, index) => (
              <li key={index} className="text-text-muted text-[12px]">
                {task.milestone.titleFr} ({task.milestone.dayLabelFr})
                {task.noteFr ? ` — ${task.noteFr}` : ''}
              </li>
            ))}
          </ul>
          <CardBody className="mt-2">
            Un blocage est rarement la faute du collaborateur : c’est souvent le sujet le
            plus utile de l’entretien.
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Formations</CardTitle>
        {evaluation.subject.trainingAttempts.length === 0 ? (
          <CardBody className="mt-1">Aucune tentative enregistrée.</CardBody>
        ) : (
          <>
            <CardBody className="mt-1">
              {passed.length} module{passed.length > 1 ? 's' : ''} réussi
              {passed.length > 1 ? 's' : ''}
              {failed.length > 0 ? `, ${failed.length} échec(s)` : ''}.
            </CardBody>
            {failed.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {failed.slice(0, 5).map((attempt, index) => (
                  <li key={index} className="text-text-muted text-[12px]">
                    {attempt.module.titleFr} — {attempt.score}%
                    {attempt.module.isMandatory ? ' (obligatoire)' : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Questions à poser</CardTitle>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {milestone.focusFr.map((question) => (
            <li key={question} className="text-text-muted text-[13px]">
              {question}
            </li>
          ))}
          {blocked.length > 0 ? (
            <li className="text-text-muted text-[13px]">
              Qu’est-ce qui a bloqué, et qui aurait pu le débloquer plus tôt ?
            </li>
          ) : null}
          {failed.length > 0 ? (
            <li className="text-text-muted text-[13px]">
              Les modules échoués sont-ils un problème de contenu ou de temps disponible ?
            </li>
          ) : null}
        </ul>
      </Card>

      <Card className="print:hidden">
        <CardTitle>Enquêtes de satisfaction</CardTitle>
        <CardBody className="mt-1">
          Volontairement absentes de cette trame. Le collaborateur répond en sachant que son
          responsable ne lira pas ses réponses ; les faire remonter ici, même résumées,
          reviendrait à retirer cette garantie. Le score consolidé va aux RH.
        </CardBody>
        <div className="mt-3">
          <StatusBadge label="Rédigé sans modèle de langage" tone="neutral" />
        </div>
      </Card>

      <div className="print:hidden">
        <Link
          href={`/app/manager/evaluations/${evaluation.id}`}
          className="text-red-strong text-[12px] font-medium"
        >
          Remplir l’évaluation →
        </Link>
      </div>
    </div>
  );
}
