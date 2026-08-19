import { getTranslations, setRequestLocale } from 'next-intl/server';

import { loadPublicPositions } from '@/application/public/presentation';
import { SourceText } from '@/components/public/source-text';
import {
  Card,
  CardBody,
  DataTable,
  EmptyState,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';

/** Open positions — the platform's careers page. */
export default async function PublicCareers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('public');
  const positions = await loadPublicPositions().catch(() => []);

  if (positions.length === 0) {
    return <EmptyState title={t('careers.title')} description={t('careers.empty')} />;
  }

  type Position = (typeof positions)[number];

  const columns: Column<Position>[] = [
    {
      key: 'title',
      header: 'Poste',
      render: (row) => <SourceText className="text-text font-medium">{row.titleFr}</SourceText>,
    },
    {
      key: 'attachment',
      header: t('careers.attachment'),
      render: (row) => <SourceText>{row.attachmentFr}</SourceText>,
    },
    {
      key: 'status',
      header: t('careers.status'),
      align: 'end',
      render: (row) => <StatusBadge label={row.statusFr} tone="gold" />,
    },
  ];

  return (
    <div className="space-y-8">
      <SectionTitle lead={t('careers.lead')}>{t('careers.title')}</SectionTitle>

      <DataTable
        columns={columns}
        rows={positions}
        getRowKey={(row) => row.titleFr}
        emptyLabel={t('careers.empty')}
        caption={t('careers.title')}
      />

      <Card>
        <CardBody>{t('careers.apply')}</CardBody>
      </Card>
    </div>
  );
}
