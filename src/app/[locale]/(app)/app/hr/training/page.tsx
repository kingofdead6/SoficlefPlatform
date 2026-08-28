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

/**
 * The training catalogue, as HR administers it (`/app/hr/training`).
 *
 * The pass rate is shown per module because it is the only number that says whether a
 * module *works*. A module everybody fails is either badly written or badly placed, and
 * both are HR's problem rather than the learner's.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/training');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const modules = await prisma.trainingModule
    .findMany({
      where: { archivedAt: null },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        code: true,
        titleFr: true,
        summaryFr: true,
        isMandatory: true,
        isPlaceholder: true,
        passingScore: true,
        _count: { select: { questions: true, attempts: true } },
        attempts: { where: { passed: true }, select: { id: true } },
      },
    })
    .catch(() => []);

  const columns: Column<(typeof modules)[number]>[] = [
    {
      key: 'title',
      header: 'Module',
      render: (row) => (
        <>
          <span className="text-text font-medium">{row.titleFr}</span>
          <span className="text-text-dim block font-mono text-[11px]">{row.code}</span>
        </>
      ),
    },
    {
      key: 'mandatory',
      header: 'Caractère',
      render: (row) => (
        <StatusBadge
          label={row.isMandatory ? 'Obligatoire' : 'Optionnel'}
          tone={row.isMandatory ? 'brand' : 'neutral'}
        />
      ),
    },
    {
      key: 'quiz',
      header: 'Quiz',
      align: 'end',
      mono: true,
      render: (row) =>
        row._count.questions === 0
          ? '—'
          : `${row._count.questions} q. · seuil ${row.passingScore}%`,
    },
    {
      key: 'passRate',
      header: 'Réussite',
      align: 'end',
      mono: true,
      render: (row) =>
        row._count.attempts === 0
          ? '—'
          : `${Math.round((row.attempts.length / row._count.attempts) * 100)}% (${row._count.attempts})`,
    },
    {
      key: 'quizLink',
      header: '',
      render: (row) => (
        <Link href={`/app/hr/training/${row.id}/quiz`} className="text-red-strong text-[12px]">
          Quiz →
        </Link>
      ),
    },
  ];

  const placeholders = modules.filter((module) => module.isPlaceholder).length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Les modules de micro-apprentissage et leur taux de réussite. Un module que tout le monde échoue est un problème de contenu, pas d’apprenant.">
          Catalogue de formation
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={modules.length} label="Modules" />
          <KpiTile
            value={modules.filter((module) => module.isMandatory).length}
            label="Obligatoires"
          />
          <KpiTile
            value={modules.reduce((sum, module) => sum + module._count.attempts, 0)}
            label="Tentatives"
          />
          <KpiTile
            value={placeholders}
            label="Contenu à rédiger"
            hint={placeholders > 0 ? 'Textes provisoires' : undefined}
          />
        </div>
      </section>

      {modules.length === 0 ? (
        <Card>
          <CardBody>Aucun module publié.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={modules}
          getRowKey={(row) => row.id}
          emptyLabel="Aucun module."
          caption="Catalogue de formation"
        />
      )}

      {placeholders > 0 ? (
        <Card accent="red">
          <CardBody>
            {placeholders} module{placeholders > 1 ? 's portent' : ' porte'} un contenu
            provisoire, repris du cahier des charges en attendant les textes de l’entreprise.
            Ils sont utilisables mais ne font pas foi.
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
