import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { AcknowledgeButton } from '@/components/me/acknowledge-button';
import { Card, CardBody, CardTitle, EmptyState, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * The reference documents a recruit must read (`/app/me/documents`).
 *
 * Acceptance is recorded per person with a timestamp, which is the point: "everyone was
 * sent the IT charter" is not the same claim as "this person accepted it on this date",
 * and only the second one is worth anything afterwards.
 */

const AVAILABILITY: Record<string, { label: string; tone: 'green' | 'neutral' | 'red' }> = {
  AVAILABLE: { label: 'Disponible', tone: 'green' },
  ON_REQUEST: { label: 'Sur demande', tone: 'neutral' },
  IN_PREPARATION: { label: 'En préparation', tone: 'red' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/documents');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const documents = await prisma.document
    .findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        titleFr: true,
        detailFr: true,
        fileName: true,
        availability: true,
        acknowledgements: {
          where: { userId: user.id },
          select: { acceptedAt: true },
          take: 1,
        },
      },
    })
    .catch(() => []);

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Mes documents"
        description="Aucun document de référence n’est publié pour l’instant."
      />
    );
  }

  const accepted = documents.filter((doc) => doc.acknowledgements.length > 0).length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Guide d’accueil, règlement intérieur, procédures et charte informatique. Votre acceptation est horodatée et vous reste opposable — comme une signature.">
          Mes documents
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={documents.length} label="Documents" />
          <KpiTile
            value={accepted}
            label="Acceptés"
            hint={accepted === documents.length ? 'Tout est lu' : 'À compléter'}
          />
          <KpiTile value={documents.length - accepted} label="Restants" />
        </div>
      </section>

      <ul className="space-y-3">
        {documents.map((document) => {
          const state = AVAILABILITY[document.availability] ?? {
            label: document.availability,
            tone: 'neutral' as const,
          };
          const acceptedAt = document.acknowledgements[0]?.acceptedAt ?? null;

          return (
            <li key={document.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{document.titleFr}</CardTitle>
                    {document.detailFr ? (
                      <CardBody className="mt-1">{document.detailFr}</CardBody>
                    ) : null}
                    {document.fileName ? (
                      <p className="text-text-dim mt-1 font-mono text-[11px]">
                        {document.fileName}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge label={state.label} tone={state.tone} />
                    <AcknowledgeButton
                      documentId={document.id}
                      acceptedLabel={
                        acceptedAt
                          ? `Accepté le ${formatDate(acceptedAt, locale as Locale)}`
                          : null
                      }
                    />
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
