import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let documents: Awaited<ReturnType<typeof loadDocuments>> = [];

  try {
    documents = await loadDocuments();
  } catch (error) {
    console.error('Failed to load documents data:', error);
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Documents"
        description="La bibliothèque de documents n'est pas encore disponible."
      />
    );
  }

  const available = documents.filter((doc) => doc.availability === 'AVAILABLE');
  const pending = documents.filter((doc) => doc.availability === 'PENDING');

  return (
    <div className="space-y-8">
      {available.length > 0 && (
        <section>
          <SectionTitle>Documents disponibles</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {available.map((doc) => (
              <Card key={doc.id}>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{doc.titleFr}</CardTitle>
                  <StatusBadge label="Disponible" tone="green" />
                </div>
                <CardBody className="text-text space-y-1">
                  {doc.fileName && <p className="font-mono text-[12px]">{doc.fileName}</p>}
                  {doc.detailFr && <p className="text-text-muted text-[12.5px]">{doc.detailFr}</p>}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <SectionTitle>Documents en attente</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pending.map((doc) => (
              <Card key={doc.id}>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{doc.titleFr}</CardTitle>
                  <StatusBadge label="En attente" tone="neutral" />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function loadDocuments() {
  return prisma.document.findMany({ orderBy: [{ availability: 'asc' }, { order: 'asc' }] });
}
