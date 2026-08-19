import { getTranslations, setRequestLocale } from 'next-intl/server';

import { loadPublicStrategy } from '@/application/public/presentation';
import { SourceText } from '@/components/public/source-text';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  EmptyState,
  SectionTitle,
  type Column,
} from '@/components/ui';

/** The 2024–2026 strategic plan, as the company presents it publicly. */
export default async function PublicStrategy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('public');
  const strategy = await loadPublicStrategy().catch(() => null);

  if (!strategy) {
    return <EmptyState title={t('strategy.title')} description={t('careers.empty')} />;
  }

  type Market = (typeof strategy.markets)[number];

  const columns: Column<Market>[] = [
    { key: 'market', header: 'Marché', render: (row) => <SourceText>{row.marketFr}</SourceText> },
    {
      key: 'strategy',
      header: 'Stratégie',
      render: (row) => <SourceText>{row.strategyFr}</SourceText>,
    },
    {
      key: 'share',
      header: 'Part de marché',
      align: 'end',
      mono: true,
      render: (row) => row.marketShareTargetFr,
    },
    {
      key: 'revenue',
      header: 'Cible CA',
      align: 'end',
      mono: true,
      render: (row) => row.revenueTargetFr,
    },
  ];

  return (
    <div className="space-y-10">
      <SectionTitle lead={t('strategy.lead')}>{t('strategy.title')}</SectionTitle>

      <Card accent="gold">
        <CardTitle>{strategy.planFr}</CardTitle>
        <CardBody className="text-text mt-1">
          <SourceText>{strategy.globalObjectiveFr}</SourceText>
        </CardBody>
      </Card>

      {strategy.markets.length > 0 ? (
        <section>
          <SectionTitle level={3}>{t('strategy.markets')}</SectionTitle>
          <DataTable
            columns={columns}
            rows={strategy.markets}
            getRowKey={(row) => row.marketFr}
            emptyLabel="—"
            caption={t('strategy.markets')}
          />
        </section>
      ) : null}

      {strategy.projects.length > 0 ? (
        <section>
          <SectionTitle level={3}>{t('strategy.projects')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {strategy.projects.map((project) => (
              <Card key={project.code}>
                <CardTitle>
                  {project.code} — {project.titleFr}
                </CardTitle>
                <CardBody className="text-text mt-1">
                  <SourceText>{project.descriptionFr}</SourceText>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
