import { setRequestLocale } from 'next-intl/server';

import {
  Card,
  CardBody,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  SectionTitle,
} from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { formatPercent } from '@/lib/format';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let strategy: Awaited<ReturnType<typeof loadStrategy>> = null;

  try {
    strategy = await loadStrategy();
  } catch (error) {
    console.error('Failed to load strategy data:', error);
  }

  if (!strategy) {
    return (
      <EmptyState
        title="Plan stratégique"
        description="Le plan stratégique n'est pas encore disponible."
      />
    );
  }

  const marketColumns: Column<(typeof strategy.markets)[number]>[] = [
    { key: 'market', header: 'Marché', render: (row) => row.marketFr },
    { key: 'strategy', header: 'Stratégie', render: (row) => row.strategyFr },
    {
      key: 'share',
      header: 'PDM cible',
      align: 'end',
      mono: true,
      render: (row) => row.marketShareTargetFr,
    },
    {
      key: 'revenue',
      header: 'CA cible',
      align: 'end',
      mono: true,
      render: (row) => row.revenueTargetFr,
    },
  ];

  return (
    <div className="space-y-8">
      <Card accent="gold">
        <CardTitle>{strategy.planFr}</CardTitle>
        <CardBody className="text-text text-[13.5px]">{strategy.globalObjectiveFr}</CardBody>
      </Card>

      {strategy.markets.length > 0 && (
        <section>
          <SectionTitle>Objectifs de marché 2024–2026</SectionTitle>
          <DataTable
            columns={marketColumns}
            rows={strategy.markets}
            getRowKey={(row) => row.id}
            caption="Objectifs de marché"
            emptyLabel="Aucun objectif de marché"
          />
        </section>
      )}

      {strategy.projects.length > 0 && (
        <section>
          <SectionTitle>Projets stratégiques</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {strategy.projects.map((project) => (
              <Card key={project.id}>
                <CardTitle>{project.code}</CardTitle>
                <CardBody className="text-text">
                  <p className="font-medium">{project.titleFr}</p>
                  <p className="mt-1">{project.descriptionFr}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {strategy.contributions.length > 0 && (
        <section>
          <SectionTitle>Contribution DPR aux objectifs</SectionTitle>
          <div className="space-y-3">
            {strategy.contributions.map((contribution) => (
              <Card key={contribution.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-text text-[13.5px] font-medium">{contribution.labelFr}</p>
                    <p className="text-text-muted text-[12px]">Cible : {contribution.targetFr}</p>
                  </div>
                  <span className="text-gold font-mono text-lg tabular-nums">
                    {formatPercent(contribution.progressPercent, locale as Locale)}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--surface2)">
                  <div
                    className="h-full rounded-full bg-(--gold)"
                    style={{
                      width: `${Math.min(100, Math.max(0, contribution.progressPercent))}%`,
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function loadStrategy() {
  return prisma.strategy.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      markets: { orderBy: { order: 'asc' } },
      projects: { orderBy: { order: 'asc' } },
      contributions: { orderBy: { order: 'asc' } },
    },
  });
}
