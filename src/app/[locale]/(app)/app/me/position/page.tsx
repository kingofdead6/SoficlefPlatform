import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { PositionTree, buildPositionForest } from '@/components/me/position-tree';
import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import {
  currentPositionIdFor,
  getVisibleTree,
} from '@/infrastructure/repositories/position-repository';

/**
 * The recruit's own job description (`/app/me/position`).
 *
 * Everything is read from the post they actually hold, through their open assignment —
 * not from the free-text title on their user record. The two can disagree after a
 * reassignment, and the assignment is the one that is true.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/position');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const positionId = await currentPositionIdFor(user.id).catch(() => null);

  if (!positionId) {
    return (
      <EmptyState
        title="Mon poste"
        description="Aucun poste ne vous est encore attribué. Les RH s’en chargent ; en attendant, votre parcours reste accessible."
      />
    );
  }

  const [position, assignment, tree] = await Promise.all([
    prisma.position
      .findUnique({
        where: { id: positionId },
        select: {
          titleFr: true,
          code: true,
          missionFr: true,
          organizationUnit: { select: { nameFr: true, code: true } },
          parentPosition: {
            select: {
              titleFr: true,
              assignments: {
                where: { endDate: null },
                select: { user: { select: { displayName: true } } },
                take: 1,
              },
            },
          },
          jobCompetencies: {
            select: {
              requiredLevel: true,
              competency: { select: { nameFr: true, family: { select: { nameFr: true } } } },
            },
          },
          jobDescription: { select: { code: true, jobTitleFr: true } },
        },
      })
      .catch(() => null),

    prisma.assignment
      .findFirst({
        where: { userId: user.id, endDate: null },
        select: { startDate: true },
      })
      .catch(() => null),

    getVisibleTree(user).catch(() => []),
  ]);

  if (!position) notFound();

  // The chart snippet: this post and whatever hangs directly off it.
  const forest = buildPositionForest(tree).filter(
    (node) => node.id === positionId || node.children.some((child) => child.id === positionId),
  );

  const manager = position.parentPosition?.assignments[0]?.user.displayName ?? null;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead={position.missionFr ?? 'La mission de ce poste n’est pas encore renseignée.'}>
          {position.titleFr}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
            {position.code}
          </span>
          {assignment ? (
            <span className="text-text-muted font-mono text-[11px]">
              Depuis le {formatDate(assignment.startDate, locale as Locale)}
            </span>
          ) : null}
          {position.jobDescription ? (
            <StatusBadge label={`Fiche ${position.jobDescription.code}`} tone="neutral" />
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Rattachement</CardTitle>
          <CardBody className="mt-1">
            {position.organizationUnit
              ? `${position.organizationUnit.nameFr} (${position.organizationUnit.code})`
              : 'Aucune structure rattachée.'}
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Lien hiérarchique</CardTitle>
          <CardBody className="mt-1">
            {position.parentPosition
              ? `${position.parentPosition.titleFr}${manager ? ` — ${manager}` : ' (poste vacant)'}`
              : 'Ce poste ne rapporte à aucun autre.'}
          </CardBody>
        </Card>
      </div>

      {position.jobCompetencies.length > 0 ? (
        <section>
          <SectionTitle level={2} lead="Le niveau attendu sur ce poste. Votre niveau acquis est évalué par votre responsable.">
            Compétences requises
          </SectionTitle>
          <ul className="space-y-2">
            {position.jobCompetencies.map((link) => (
              <li
                key={link.competency.nameFr}
                className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-2.5"
              >
                <div>
                  <span className="text-text text-[13px]">{link.competency.nameFr}</span>
                  {link.competency.family ? (
                    <span className="text-text-dim ms-2 text-[11px]">
                      {link.competency.family.nameFr}
                    </span>
                  ) : null}
                </div>
                <span className="text-text-muted font-mono text-[11px]">
                  Niveau {link.requiredLevel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {forest.length > 0 ? (
        <section>
          <SectionTitle level={2}>Situation dans l’organigramme</SectionTitle>
          <PositionTree nodes={forest} highlightId={positionId} />
        </section>
      ) : null}
    </div>
  );
}
