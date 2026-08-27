import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { assignableParents } from '@/application/organization/parents';
import { canOpen } from '@/application/navigation/build-navigation';
import { OrgTree, buildForest } from '@/components/organization/org-tree';
import {
  ArchiveUnitButton,
  CreateUnitDialog,
  EditUnitDialog,
} from '@/components/organization/unit-dialogs';
import { Card, CardBody, EmptyState, KpiTile, SectionTitle } from '@/components/ui';
import { can, scopeFilterFor } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Organization and structures (CDC v0.1 §5, §5.1).
 *
 * The tree is a query over the same table that anchors RBAC scope, not a duplicate of
 * it: what a reader sees here is exactly the perimeter their rights cover, because the
 * scope predicate is in the `where` clause (ADR-021).
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/organization');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const t = await getTranslations('organization');
  const scope = scopeFilterFor(user, 'read', 'organization_unit');

  const units =
    scope.kind === 'none' || scope.kind === 'self'
      ? []
      : await prisma.organizationUnit
          .findMany({
            where: {
              archivedAt: null,
              ...(scope.kind === 'units' ? { id: { in: scope.organizationUnitIds } } : {}),
            },
            orderBy: [{ type: 'asc' }, { code: 'asc' }],
            select: {
              id: true,
              code: true,
              nameFr: true,
              type: true,
              parentId: true,
              headLabelFr: true,
              headOccupancy: true,
              descriptionFr: true,
            },
          })
          .catch((error) => {
            console.error('Failed to load organization units:', error);
            return [];
          });

  if (units.length === 0) {
    return (
      <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
    );
  }

  const mayCreate = can(user, 'create', 'organization_unit');
  const parents = mayCreate ? await assignableParents(user) : [];

  const forest = buildForest(units);
  const vacant = units.filter((unit) => unit.headOccupancy === 'VACANT').length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile value={units.length} label={t('units')} />
        <KpiTile
          value={units.filter((unit) => unit.type === 'STRUCTURE').length}
          label={t('structures')}
        />
        <KpiTile value={units.filter((unit) => unit.type === 'CELLULE').length} label={t('cells')} />
        <KpiTile value={vacant} label={t('vacantPosts')} />
      </div>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            className="mb-0"
            lead={t('treeLead')}
          >
            {t('treeTitle')}
          </SectionTitle>
          {mayCreate ? <CreateUnitDialog parents={parents} /> : null}
        </div>

        <OrgTree
          nodes={forest}
          renderActions={(node) => {
            const target = { organizationUnitId: node.id };
            const mayEdit = can(user, 'update', 'organization_unit', target);
            const mayArchive = can(user, 'delete', 'organization_unit', target);
            if (!mayEdit && !mayArchive) return null;

            return (
              <span className="flex flex-wrap items-center justify-end gap-2">
                {mayEdit ? (
                  <EditUnitDialog
                    unit={{
                      id: node.id,
                      nameFr: node.nameFr,
                      type: node.type,
                      descriptionFr: node.descriptionFr,
                      headLabelFr: node.headLabelFr,
                      headOccupancy: node.headOccupancy,
                    }}
                  />
                ) : null}
                {mayArchive ? <ArchiveUnitButton id={node.id} name={node.nameFr} /> : null}
              </span>
            );
          }}
        />
      </section>

      <Card>
        <CardBody>
          Rien n&apos;est supprimé : archiver une structure la retire des listes actives tout en
          préservant l&apos;historique (§16.1). Une structure qui porte encore des entités ou des
          emplois actifs ne peut pas être archivée — la réorganisation se fait explicitement, en
          partant des feuilles.
        </CardBody>
      </Card>
    </div>
  );
}
