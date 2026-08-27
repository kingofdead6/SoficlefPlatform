import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import {
  currentPositionIdFor,
  getVisibleTree,
} from '@/infrastructure/repositories/position-repository';

/**
 * The people around the recruit (`/app/me/team`).
 *
 * Three groups, in the order somebody new actually needs them: their manager, the peers
 * they will work beside, and the key services to call. All of it comes from the same
 * visible tree the org chart uses, so this page can never name somebody the chart hides.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/team');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [tree, myPositionId, contacts] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    currentPositionIdFor(user.id).catch(() => null),
    prisma.contact
      .findMany({
        select: { id: true, nameFr: true, roleFr: true, extension: true, priorityFr: true },
        orderBy: { order: 'asc' },
        take: 8,
      })
      .catch(() => []),
  ]);

  const mine = tree.find((node) => node.id === myPositionId) ?? null;

  const managerNode = mine?.parentPositionId
    ? (tree.find((node) => node.id === mine.parentPositionId) ?? null)
    : null;

  /*
   * Peers share the same parent post. The viewer's own seat is excluded — "my team" that
   * lists me back at myself reads as a bug, not as completeness.
   */
  const peers = mine
    ? tree.filter(
        (node) => node.id !== mine.id && node.parentPositionId === mine.parentPositionId,
      )
    : [];

  const reports = mine ? tree.filter((node) => node.parentPositionId === mine.id) : [];

  if (!mine && contacts.length === 0) {
    return (
      <EmptyState
        title="Mon équipe"
        description="Aucun poste ne vous est encore attribué, et l’annuaire n’est pas disponible."
      />
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les personnes autour de vous, et les services à appeler quand vous ne savez pas à qui vous adresser.">
          Mon équipe
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card accent={managerNode ? 'red' : undefined}>
            <CardTitle>Mon responsable</CardTitle>
            {managerNode ? (
              <>
                <CardBody className="mt-1">
                  {managerNode.holder?.displayName ?? 'Poste vacant'}
                </CardBody>
                <p className="text-text-dim text-[11px]">{managerNode.titleFr}</p>
              </>
            ) : (
              <CardBody className="mt-1">
                Aucun responsable hiérarchique n’est enregistré pour votre poste.
              </CardBody>
            )}
          </Card>

          <Card>
            <CardTitle>Mon poste</CardTitle>
            <CardBody className="mt-1">{mine?.titleFr ?? 'Non attribué'}</CardBody>
            {mine?.organizationUnitId ? null : (
              <p className="text-text-dim text-[11px]">Aucune structure rattachée.</p>
            )}
          </Card>
        </div>
      </section>

      {peers.length > 0 ? (
        <section>
          <SectionTitle level={2} lead="Les personnes qui partagent votre responsable.">
            Mes collègues
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {peers.map((peer) => (
              <li key={peer.id}>
                <Card>
                  <CardTitle>{peer.holder?.displayName ?? peer.titleFr}</CardTitle>
                  <CardBody className="mt-0.5">{peer.titleFr}</CardBody>
                  {peer.isVacant ? (
                    <div className="mt-2">
                      <StatusBadge label={peer.occupancyFr ?? 'Poste vacant'} tone="red" />
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reports.length > 0 ? (
        <section>
          <SectionTitle level={2}>Rattachés à mon poste</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Card>
                  <CardTitle>{report.holder?.displayName ?? report.titleFr}</CardTitle>
                  <CardBody className="mt-0.5">{report.titleFr}</CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contacts.length > 0 ? (
        <section>
          <SectionTitle level={2} lead="L’annuaire interne : le bon numéro sans avoir à demander.">
            Interlocuteurs clés
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-3 rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-text text-[13px] font-medium">{contact.nameFr}</p>
                  <p className="text-text-muted text-[12px]">{contact.roleFr}</p>
                </div>
                <span className="text-red-strong shrink-0 rounded bg-(--red-dim) px-2 py-0.5 font-mono text-[12px]">
                  {contact.extension}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
