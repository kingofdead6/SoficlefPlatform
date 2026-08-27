import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';
import { canOpen } from '@/application/navigation/build-navigation';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020). The layout checks too, but a
  // page that trusts its layout has no defence if that layout is ever bypassed.
  const item = navItemByHref('/hse');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  let hse: Awaited<ReturnType<typeof loadHse>> = null;

  try {
    hse = await loadHse();
  } catch (error) {
    console.error('Failed to load HSE data:', error);
  }

  if (!hse) {
    return (
      <EmptyState title="HSE" description="Les consignes HSE ne sont pas encore disponibles." />
    );
  }

  const trafficRules = hse.rules.filter((rule) => rule.kind === 'TRAFFIC');
  const ppeRules = hse.rules.filter((rule) => rule.kind === 'PPE');

  return (
    <div className="space-y-8">
      <Card accent="red">
        <CardTitle>{hse.siteFr}</CardTitle>
        <CardBody className="text-text text-[13.5px]">Contact HSE : {hse.contactFr}</CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Zones</CardTitle>
          <CardBody className="text-text">{hse.zonesFr}</CardBody>
        </Card>
        <Card>
          <CardTitle>Zone à risque</CardTitle>
          <CardBody className="text-text">{hse.riskAreaFr}</CardBody>
        </Card>
      </div>

      <Card>
        <CardTitle>Plan de circulation</CardTitle>
        <CardBody className="text-text">{hse.circulationPlanNoteFr}</CardBody>
      </Card>

      {trafficRules.length > 0 && (
        <section>
          <SectionTitle>Règles de circulation</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {trafficRules.map((rule) => (
              <li key={rule.id} className="text-text text-[13.5px]">
                {rule.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ppeRules.length > 0 && (
        <section>
          <SectionTitle>Équipements de protection obligatoires</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {ppeRules.map((rule) => (
              <li key={rule.id} className="text-text text-[13.5px]">
                {rule.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function loadHse() {
  return prisma.hse.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { rules: { orderBy: { order: 'asc' } } },
  });
}
