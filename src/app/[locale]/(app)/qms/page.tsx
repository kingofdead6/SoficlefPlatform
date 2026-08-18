import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let qms: Awaited<ReturnType<typeof loadQms>> = null;

  try {
    qms = await loadQms();
  } catch (error) {
    console.error('Failed to load QMS data:', error);
  }

  if (!qms) {
    return (
      <EmptyState
        title="SMQ · ISO 9001"
        description="Les informations SMQ ne sont pas encore disponibles."
      />
    );
  }

  const categoryLabels: Record<string, string> = {};
  for (const process of qms.processes) categoryLabels[process.category] ??= process.categoryLabelFr;

  return (
    <div className="space-y-8">
      <Card accent="gold">
        <CardTitle>
          {qms.standardFr} · Certifié depuis {qms.certifiedSinceFr}
        </CardTitle>
        <CardBody className="text-text space-y-1 text-[13.5px]">
          <p>Organisme certificateur : {qms.certificationBodyFr}</p>
          <p>Périmètre : {qms.certificationScopeFr}</p>
          <p>Cartographie des processus : {qms.processMapCode}</p>
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Processus piloté — {qms.ownedProcessCode}</CardTitle>
        <CardBody className="text-text">{qms.ownedProcessNoteFr}</CardBody>
      </Card>

      {qms.responsibilities.length > 0 && (
        <section>
          <SectionTitle>Responsabilités</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {qms.responsibilities.map((responsibility) => (
              <li key={responsibility.id} className="text-text text-[13.5px]">
                {responsibility.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {qms.processes.length > 0 && (
        <section>
          <SectionTitle>Cartographie des processus</SectionTitle>
          {(['MANAGEMENT', 'REALISATION', 'SUPPORT'] as const)
            .filter((category) => qms.processes.some((process) => process.category === category))
            .map((category) => (
              <div key={category} className="mb-5">
                <h4 className="text-gold mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase">
                  {categoryLabels[category]}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {qms.processes
                    .filter((process) => process.category === category)
                    .map((process) => (
                      <Card key={process.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-text font-mono text-[12.5px]">{process.code}</p>
                          <p className="text-text text-[13px]">{process.nameFr}</p>
                        </div>
                        {process.isOwnedByProductionDirector && (
                          <StatusBadge label="Piloté par vous" tone="gold" />
                        )}
                      </Card>
                    ))}
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

async function loadQms() {
  return prisma.qms.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      responsibilities: { orderBy: { order: 'asc' } },
      processes: { orderBy: { order: 'asc' } },
    },
  });
}
