import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { assignableParents } from '@/application/organization/parents';
import { canOpen } from '@/application/navigation/build-navigation';
import { CreateUnitDialog, EditUnitDialog } from '@/components/organization/unit-dialogs';
import { OrgTree, buildForest } from '@/components/organization/org-tree';
import { PositionTree, buildPositionForest } from '@/components/me/position-tree';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { getVisibleTree } from '@/infrastructure/repositories/position-repository';

/**
 * The structural skeleton (`/admin/organization`).
 *
 * Two trees that are deliberately not the same thing. Structures are the boxes — divisions,
 * departments, cells — and posts are the seats inside them. An administrator defines both
 * shapes; HR fills the seats with people. Editing a structure here moves the box, and
 * everything hanging off it moves with it.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/organization');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [units, positions, parents] = await Promise.all([
    prisma.organizationUnit
      .findMany({
        where: { archivedAt: null },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          nameFr: true,
          nameAr: true,
          nameEn: true,
          type: true,
          parentId: true,
          icon: true,
          descriptionFr: true,
          headOccupancy: true,
          headLabelFr: true,
          criticalNoteFr: true,
          staffingFr: true,
          archivedAt: true,
        },
      })
      .catch(() => []),
    getVisibleTree(user).catch(() => []),
    assignableParents(user).catch(() => []),
  ]);

  const forest = buildForest(units);
  const positionForest = buildPositionForest(positions);
  const orphanPositions = positions.filter((node) => node.organizationUnitId === null);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Le squelette que les RH remplissent : les structures d’abord, les postes ensuite, les personnes en dernier — et par quelqu’un d’autre.">
          Structure
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={units.length} label="Structures" />
          <KpiTile value={positions.length} label="Postes" />
          <KpiTile
            value={positions.filter((node) => node.isVacant).length}
            label="Postes vacants"
          />
          <KpiTile
            value={orphanPositions.length}
            label="Postes hors structure"
            hint={orphanPositions.length > 0 ? 'À rattacher' : undefined}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle className="mb-0" level={2} lead="Archiver plutôt que supprimer : une structure disparue emporterait l’historique des postes qui l’ont citée.">
            Structures
          </SectionTitle>
          <CreateUnitDialog parents={parents} />
        </div>

        {forest.length === 0 ? (
          <Card>
            <CardBody>Aucune structure. Créez-en une pour commencer l’arborescence.</CardBody>
          </Card>
        ) : (
          <OrgTree
            nodes={forest}
            renderActions={(node) => <EditUnitDialog unit={node} />}
          />
        )}
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="L’arborescence des postes, qui suit sa propre ligne hiérarchique — un poste peut relever d’un autre poste sans changer de structure."
        >
          Postes
        </SectionTitle>

        {positionForest.length === 0 ? (
          <Card>
            <CardBody>Aucun poste défini.</CardBody>
          </Card>
        ) : (
          <PositionTree nodes={positionForest} />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card accent={orphanPositions.length > 0 ? 'red' : undefined}>
          <CardTitle>Postes sans structure</CardTitle>
          <CardBody className="mt-1">
            {orphanPositions.length === 0
              ? 'Chaque poste est rattaché à une structure.'
              : `${orphanPositions.length} poste(s) n’appartiennent à aucune structure : ils apparaissent dans l’organigramme sans périmètre, et aucun responsable ne les voit.`}
          </CardBody>
          {orphanPositions.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {orphanPositions.slice(0, 6).map((node) => (
                <li key={node.id} className="text-text-muted text-[12px]">
                  {node.titleFr}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Créer et déplacer des postes</CardTitle>
          <CardBody className="mt-1">
            L’édition des postes n’est pas encore ouverte depuis cet écran. Déplacer un poste
            change la ligne hiérarchique de tout ce qui en dépend et le périmètre de plusieurs
            responsables : c’est une opération qui demande une prévisualisation de ses effets,
            pas un formulaire.
          </CardBody>
          <Link href="/app/hr/positions" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Consulter les fiches de poste →
          </Link>
        </Card>
      </div>
    </div>
  );
}
