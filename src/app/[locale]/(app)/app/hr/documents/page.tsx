import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  DataTable,
  KpiTile,
  ProgressBar,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { isStorageConfigured } from '@/infrastructure/storage/file-storage';

/**
 * The document library, as HR administers it (`/app/hr/documents`).
 *
 * The column that matters is the acknowledgement rate: publishing a document is easy and
 * proves nothing, while "eleven of fourteen people have accepted the IT charter" is the
 * fact somebody will be asked for.
 */

const AVAILABILITY: Record<string, { label: string; tone: StatusTone }> = {
  AVAILABLE: { label: 'Disponible', tone: 'green' },
  ON_REQUEST: { label: 'Sur demande', tone: 'neutral' },
  IN_PREPARATION: { label: 'En préparation', tone: 'red' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/documents');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [documents, audience] = await Promise.all([
    prisma.document
      .findMany({
        orderBy: { order: 'asc' },
        select: {
          id: true,
          titleFr: true,
          detailFr: true,
          fileName: true,
          availability: true,
          _count: { select: { acknowledgements: true } },
        },
      })
      .catch(() => []),
    // Everybody who could be asked to accept: the denominator of the rate.
    prisma.user.count({ where: { status: 'ACTIVE', lifecycleState: 'ASSIGNED' } }).catch(() => 0),
  ]);

  const columns: Column<(typeof documents)[number]>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (row) => (
        <>
          <span className="text-text font-medium">{row.titleFr}</span>
          {row.fileName ? (
            <span className="text-text-dim block font-mono text-[11px]">{row.fileName}</span>
          ) : null}
        </>
      ),
    },
    {
      key: 'availability',
      header: 'Disponibilité',
      render: (row) => {
        const state = AVAILABILITY[row.availability] ?? {
          label: row.availability,
          tone: 'neutral' as StatusTone,
        };
        return <StatusBadge label={state.label} tone={state.tone} />;
      },
    },
    {
      key: 'accepted',
      header: 'Acceptations',
      align: 'end',
      mono: true,
      render: (row) =>
        audience === 0
          ? `${row._count.acknowledgements}`
          : `${row._count.acknowledgements}/${audience}`,
    },
  ];

  const totalAcks = documents.reduce((sum, doc) => sum + doc._count.acknowledgements, 0);
  const expected = documents.length * audience;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="La bibliothèque de référence, et surtout qui l’a lue. Une acceptation est horodatée et nominative : c’est ce qui la rend opposable.">
          Bibliothèque documentaire
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={documents.length} label="Documents" />
          <KpiTile value={audience} label="Destinataires" />
          <KpiTile
            value={expected === 0 ? '—' : `${Math.round((totalAcks / expected) * 100)}%`}
            label="Taux d’acceptation"
          />
        </div>

        {expected > 0 ? (
          <ProgressBar
            className="mt-4"
            value={Math.round((totalAcks / expected) * 100)}
            label="Acceptations, toutes personnes et tous documents confondus"
          />
        ) : null}
      </section>

      {documents.length === 0 ? (
        <Card>
          <CardBody>Aucun document publié.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={documents}
          getRowKey={(row) => row.id}
          emptyLabel="Aucun document."
          caption="Bibliothèque documentaire"
        />
      )}

      <Card accent={isStorageConfigured() ? undefined : 'red'}>
        <CardBody>
          {isStorageConfigured()
            ? 'Le dépôt de fichiers est actif : vous pouvez téléverser et versionner directement.'
            : 'Le téléversement n’est pas activé : aucun espace de stockage n’est configuré. Les documents référencés ici sont diffusés par les canaux habituels, et les acceptations sont enregistrées normalement. Activer le stockage n’exigera aucune reprise des données.'}
        </CardBody>
      </Card>
    </div>
  );
}
