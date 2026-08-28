import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  DataTable,
  KpiTile,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { scopeFilterFor } from '@/domain/auth/authorization';

/**
 * The job-description library (`/app/hr/positions`).
 *
 * A post is a node of the org tree, not a document filed beside it: the reporting line,
 * the structure and the vacancy shown here are the same columns the chart draws from, so
 * editing a post here moves it there.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/positions');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const scope = scopeFilterFor(user, 'read', 'position');

  const positions =
    scope.kind === 'none'
      ? []
      : await prisma.position
          .findMany({
            where: {
              archivedAt: null,
              ...(scope.kind === 'units'
                ? { organizationUnitId: { in: scope.organizationUnitIds } }
                : {}),
            },
            orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
            select: {
              id: true,
              code: true,
              titleFr: true,
              missionFr: true,
              isVacant: true,
              occupancyFr: true,
              organizationUnit: { select: { code: true, nameFr: true } },
              parentPosition: { select: { titleFr: true } },
              jobDescription: { select: { code: true } },
              _count: { select: { jobCompetencies: true, onboardingTemplates: true } },
              assignments: {
                where: { endDate: null },
                select: { user: { select: { id: true, displayName: true } } },
                take: 1,
              },
            },
          })
          .catch(() => []);

  const columns: Column<(typeof positions)[number]>[] = [
    {
      key: 'title',
      header: 'Poste',
      render: (row) => (
        <>
          <span className="text-text font-medium">{row.titleFr}</span>
          <span className="text-text-dim block font-mono text-[11px]">{row.code}</span>
        </>
      ),
    },
    {
      key: 'unit',
      header: 'Structure',
      render: (row) => row.organizationUnit?.code ?? '—',
    },
    {
      key: 'parent',
      header: 'Rattaché à',
      render: (row) => row.parentPosition?.titleFr ?? '—',
    },
    {
      key: 'holder',
      header: 'Titulaire',
      render: (row) => {
        const holder = row.assignments[0]?.user;
        if (holder) {
          return (
            <Link href={`/app/hr/employees/${holder.id}`} className="text-red-strong">
              {holder.displayName}
            </Link>
          );
        }
        return <StatusBadge label={row.occupancyFr ?? 'Vacant'} tone="red" />;
      },
    },
    {
      key: 'frame',
      header: 'Référentiel',
      align: 'end',
      mono: true,
      render: (row) =>
        `${row._count.jobCompetencies} comp. · ${row._count.onboardingTemplates} parcours`,
    },
  ];

  const vacant = positions.filter((position) => position.assignments.length === 0).length;
  const described = positions.filter((position) => position.jobDescription !== null).length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Chaque fiche de poste est un nœud de l’organigramme. La modifier déplace le poste dans la structure — ce ne sont pas deux référentiels séparés.">
          Fiches de poste
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={positions.length} label="Postes" />
          <KpiTile value={positions.length - vacant} label="Pourvus" />
          <KpiTile value={vacant} label="Vacants" />
          <KpiTile
            value={described}
            label="Avec fiche rédigée"
            hint={described < positions.length ? 'À compléter' : undefined}
          />
        </div>
      </section>

      {positions.length === 0 ? (
        <Card>
          <CardBody>Aucun poste dans votre périmètre.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={positions}
          getRowKey={(row) => row.id}
          emptyLabel="Aucun poste."
          caption="Fiches de poste"
        />
      )}

      <Card>
        <CardBody>
          La création et la modification structurelle des postes — ajouter une division,
          déplacer un nœud — relèvent de l’administration, qui définit le squelette que les
          RH remplissent. Le contenu de la fiche (mission, compétences attendues) se modifie
          depuis le référentiel des compétences.
        </CardBody>
      </Card>
    </div>
  );
}
