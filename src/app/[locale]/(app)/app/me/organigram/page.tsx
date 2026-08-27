import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { PositionTree, buildPositionForest } from '@/components/me/position-tree';
import { Card, CardBody, EmptyState, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import {
  currentPositionIdFor,
  getVisibleTree,
} from '@/infrastructure/repositories/position-repository';

/**
 * The recruit's own slice of the org chart (`/app/me/organigram`).
 *
 * Not the whole company: a configurable window around their own post — a few levels up,
 * a level or two down, and the peers who share their manager. The narrowing happens in the
 * SQL (ADR-021), so this page cannot show more than it should even if the component were
 * wrong.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/organigram');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [nodes, myPositionId] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    currentPositionIdFor(user.id).catch(() => null),
  ]);

  if (nodes.length === 0) {
    return (
      <EmptyState
        title="Mon organigramme"
        description="Aucun poste ne vous est encore attribué, il n’y a donc pas d’organigramme à centrer sur vous."
      />
    );
  }

  const forest = buildPositionForest(nodes);

  return (
    <div className="space-y-6">
      <SectionTitle lead="Votre place dans l’organisation : votre hiérarchie, vos collègues directs, et les postes qui vous sont rattachés. La profondeur visible est un paramètre de la plateforme, pas une omission.">
        Mon organigramme
      </SectionTitle>

      <Card>
        <CardBody>
          {nodes.length} poste{nodes.length > 1 ? 's' : ''} visible
          {nodes.length > 1 ? 's' : ''} depuis le vôtre.
        </CardBody>
      </Card>

      <PositionTree nodes={forest} highlightId={myPositionId} />
    </div>
  );
}
