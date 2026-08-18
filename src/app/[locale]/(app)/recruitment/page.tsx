import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let recruitment: Awaited<ReturnType<typeof loadRecruitment>> = null;

  try {
    recruitment = await loadRecruitment();
  } catch (error) {
    console.error('Failed to load recruitment data:', error);
  }

  if (!recruitment) {
    return (
      <EmptyState
        title="Recrutements en cours"
        description="Aucun recrutement n'est disponible pour le moment."
      />
    );
  }

  return (
    <div className="space-y-8">
      {recruitment.positions.length > 0 && (
        <section>
          <SectionTitle>Postes ouverts</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recruitment.positions.map((position) => (
              <Card key={position.id}>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{position.titleFr}</CardTitle>
                  <StatusBadge label={position.statusFr} tone="gold" />
                </div>
                <CardBody className="text-text">{position.attachmentFr}</CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardTitle>Mobilité interne</CardTitle>
        <CardBody className="text-text">{recruitment.internalMobilityNoteFr}</CardBody>
      </Card>

      <Card accent="gold">
        <CardTitle>Action recommandée</CardTitle>
        <CardBody className="text-text">{recruitment.recommendedActionFr}</CardBody>
      </Card>
    </div>
  );
}

async function loadRecruitment() {
  return prisma.recruitment.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { positions: { orderBy: { order: 'asc' } } },
  });
}
