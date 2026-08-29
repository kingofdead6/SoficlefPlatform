import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { EvaluationForm } from '@/components/manager/evaluation-form';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * One evaluation (`/app/manager/evaluations/[id]`).
 *
 * The form is the page. Everything above it exists to answer "who am I judging, and on
 * what" before the manager starts scoring — a review filled in without the progress in
 * view is a review of an impression.
 */

const MILESTONE: Record<string, string> = {
  DAY_30: 'Point J+30',
  DAY_90: 'Point J+90',
  PROBATION_END: 'Fin de période d’essai',
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

  /*
   * The perimeter is resolved through the recruit list, so an evaluation belonging to
   * another manager's team is *not found* rather than found-and-refused (ADR-021).
   */
  const recruits = await listRecruits(user, { includeArchived: true }).catch(() => []);
  const instanceIds = new Set(recruits.map((recruit) => recruit.instanceId));

  const evaluation = await prisma.evaluation
    .findUnique({
      where: { id },
      select: {
        id: true,
        instanceId: true,
        milestone: true,
        dueDate: true,
        status: true,
        scoreSkills: true,
        scoreAutonomy: true,
        scoreIntegration: true,
        scoreBehaviour: true,
        commentFr: true,
        recommendation: true,
        submittedAt: true,
        evaluator: { select: { displayName: true } },
        subject: { select: { id: true, displayName: true } },
      },
    })
    .catch(() => null);

  if (!evaluation || !instanceIds.has(evaluation.instanceId)) notFound();

  const recruit = recruits.find((candidate) => candidate.instanceId === evaluation.instanceId);
  const submitted = evaluation.status === 'SUBMITTED';

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/manager/evaluations" className="text-text-muted text-[12px]">
          ← Évaluations
        </Link>
        <SectionTitle
          className="mt-2"
          lead={`${MILESTONE[evaluation.milestone] ?? evaluation.milestone} · échéance ${formatDate(evaluation.dueDate, locale as Locale)}`}
        >
          {evaluation.subject.displayName}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={submitted ? 'Transmise' : evaluation.status === 'DRAFT' ? 'Brouillon' : 'À faire'}
            tone={submitted ? 'green' : evaluation.status === 'DRAFT' ? 'blue' : 'red'}
          />
          {submitted && evaluation.submittedAt ? (
            <span className="text-text-muted font-mono text-[11px]">
              Transmise le {formatDate(evaluation.submittedAt, locale as Locale)}
              {evaluation.evaluator ? ` par ${evaluation.evaluator.displayName}` : ''}
            </span>
          ) : null}
        </div>
      </div>

      {recruit ? (
        <Card>
          <CardTitle>Où en est cette personne</CardTitle>
          <CardBody className="mt-1">
            Jour {recruit.dayNumber} · {recruit.percent}% du parcours ({recruit.done}/
            {recruit.total} étapes)
            {recruit.overdue > 0 ? ` · ${recruit.overdue} en retard` : ''}
            {recruit.blocked > 0 ? ` · ${recruit.blocked} bloquée(s)` : ''}
          </CardBody>
          <div className="mt-2 flex gap-3">
            <Link
              href={`/app/manager/recruits/${recruit.userId}`}
              className="text-red-strong text-[12px] font-medium"
            >
              Ouvrir le dossier →
            </Link>
            <Link
              href={`/app/manager/interviews/${evaluation.id}`}
              className="text-text-muted text-[12px]"
            >
              Préparer l’entretien
            </Link>
          </div>
        </Card>
      ) : null}

      {submitted ? (
        <section className="space-y-4">
          <Card>
            <CardTitle>Notes</CardTitle>
            <dl className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
              {[
                ['Compétences techniques', evaluation.scoreSkills],
                ['Autonomie', evaluation.scoreAutonomy],
                ['Intégration', evaluation.scoreIntegration],
                ['Comportement professionnel', evaluation.scoreBehaviour],
              ].map(([label, score]) => (
                <div key={String(label)}>
                  <dt className="text-text-muted inline">{label} : </dt>
                  <dd className="text-text inline font-mono">{score ?? '—'} / 5</dd>
                </div>
              ))}
            </dl>
          </Card>

          {evaluation.commentFr ? (
            <Card>
              <CardTitle>Commentaire</CardTitle>
              <CardBody className="mt-1 whitespace-pre-wrap">{evaluation.commentFr}</CardBody>
            </Card>
          ) : null}
        </section>
      ) : null}

      <EvaluationForm
        evaluationId={evaluation.id}
        readOnly={submitted}
        defaults={{
          scoreSkills: evaluation.scoreSkills,
          scoreAutonomy: evaluation.scoreAutonomy,
          scoreIntegration: evaluation.scoreIntegration,
          scoreBehaviour: evaluation.scoreBehaviour,
          commentFr: evaluation.commentFr,
          recommendation: evaluation.recommendation,
        }}
      />
    </div>
  );
}
