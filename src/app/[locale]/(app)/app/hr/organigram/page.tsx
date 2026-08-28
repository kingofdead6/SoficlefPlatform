import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { PositionTree, buildPositionForest } from '@/components/me/position-tree';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { getVisibleTree } from '@/infrastructure/repositories/position-repository';

/**
 * The whole org chart, as HR reads it (`/app/hr/organigram`).
 *
 * The anomaly panel is the reason this page exists rather than being a bigger version of
 * the recruit's chart. A chart that merely renders is decoration; one that names what is
 * *wrong* with the structure — seats nobody holds, people reporting to nobody, branches
 * that hang off nothing — is a working tool.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const { locale } = await params;
  const { unit } = await searchParams;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/organigram');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [nodes, units, orphanUsers] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    prisma.organizationUnit
      .findMany({
        where: { archivedAt: null },
        // The id is what the tree nodes carry; the code is what a human reads. The filter
        // needs both, and comparing a code against an id silently matches nothing.
        select: { id: true, code: true, nameFr: true },
        orderBy: { code: 'asc' },
      })
      .catch(() => []),
    /*
     * People with a post but no reporting line. Distinct from "no manager recorded on the
     * user row": what matters is whether the *seat* hangs off anything, since that is what
     * the chart draws.
     */
    prisma.user
      .findMany({
        where: {
          lifecycleState: 'ASSIGNED',
          assignments: { some: { endDate: null, position: { parentPositionId: null } } },
        },
        select: { id: true, displayName: true },
        take: 20,
      })
      .catch(() => []),
  ]);

  const filtered = unit ? nodes.filter((node) => node.organizationUnitId === unit) : nodes;
  const forest = buildPositionForest(filtered);

  const vacant = nodes.filter((node) => node.isVacant);
  const unanchored = nodes.filter((node) => node.organizationUnitId === null);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="L’organigramme complet de votre périmètre : les postes, qui les occupe, et lesquels sont vacants.">
          Organigramme
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={nodes.length} label="Postes" />
          <KpiTile
            value={nodes.filter((node) => node.holder !== null).length}
            label="Occupés"
          />
          <KpiTile value={vacant.length} label="Vacants" hint={vacant.length > 0 ? 'À pourvoir' : undefined} />
          <KpiTile value={units.length} label="Structures" />
        </div>
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="Ce que la structure a d’incohérent. Chaque ligne est un cas à trancher, pas une erreur d’affichage."
        >
          Anomalies
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card accent={vacant.length > 0 ? 'red' : undefined}>
            <CardTitle>Postes sans titulaire</CardTitle>
            <CardBody className="mt-1">
              {vacant.length === 0
                ? 'Tous les postes sont pourvus.'
                : `${vacant.length} poste${vacant.length > 1 ? 's' : ''} vacant${vacant.length > 1 ? 's' : ''}.`}
            </CardBody>
            {vacant.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {vacant.slice(0, 5).map((node) => (
                  <li key={node.id} className="text-text-muted text-[12px]">
                    {node.titleFr}
                    {node.occupancyFr ? ` — ${node.occupancyFr}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card accent={orphanUsers.length > 0 ? 'red' : undefined}>
            <CardTitle>Postes sans rattachement</CardTitle>
            <CardBody className="mt-1">
              {orphanUsers.length === 0
                ? 'Chaque poste occupé remonte à un autre.'
                : `${orphanUsers.length} personne${orphanUsers.length > 1 ? 's' : ''} sur un poste qui ne remonte à rien.`}
            </CardBody>
            {orphanUsers.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {orphanUsers.slice(0, 5).map((person) => (
                  <li key={person.id} className="text-[12px]">
                    <Link href={`/app/hr/employees/${person.id}`} className="text-red-strong">
                      {person.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card accent={unanchored.length > 0 ? 'red' : undefined}>
            <CardTitle>Postes hors structure</CardTitle>
            <CardBody className="mt-1">
              {unanchored.length === 0
                ? 'Chaque poste appartient à une structure.'
                : `${unanchored.length} poste${unanchored.length > 1 ? 's' : ''} sans structure de rattachement.`}
            </CardBody>
            {unanchored.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {unanchored.slice(0, 5).map((node) => (
                  <li key={node.id} className="text-text-muted text-[12px]">
                    {node.titleFr}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle className="mb-0" level={2}>
            Arborescence
          </SectionTitle>

          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="unit" className="text-text block text-[12px] font-medium">
                Structure
              </label>
              <select
                id="unit"
                name="unit"
                defaultValue={unit ?? ''}
                className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-1.5 text-[13px]"
              >
                <option value="">Toutes</option>
                {units.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.code} — {candidate.nameFr}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded bg-(--red-brand) px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Filtrer
            </button>
          </form>
        </div>

        {forest.length === 0 ? (
          <Card>
            <CardBody>Aucun poste ne correspond à ce filtre.</CardBody>
          </Card>
        ) : (
          <PositionTree nodes={forest} />
        )}
      </section>

      <Card>
        <CardTitle>Réaffecter quelqu’un</CardTitle>
        <CardBody className="mt-1">
          La réaffectation se fait depuis la fiche du collaborateur, où la date de prise de
          poste est explicite et l’affectation précédente est close plutôt que supprimée.
          Un glisser-déposer sur l’organigramme rendrait ce choix implicite, et une
          réaffectation datée à tort est difficile à défaire.
        </CardBody>
        <Link href="/app/hr/employees" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
          Ouvrir l’annuaire →
        </Link>
      </Card>
    </div>
  );
}
