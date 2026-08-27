import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { SubmitFileForm } from '@/components/me/submit-file-form';
import { Card, CardBody, EmptyState, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { isStorageConfigured } from '@/infrastructure/storage/file-storage';

/**
 * The administrative papers a recruit owes HR (`/app/me/files`).
 *
 * The obligations, their statuses and the HR review all work; the file *upload* does not,
 * because no storage backend is configured (OQ-14/OQ-15). The page says so rather than
 * offering an input that would silently discard what somebody submitted.
 */

const STATUS: Record<string, { label: string; tone: StatusTone; lead: string }> = {
  REQUESTED: {
    label: 'À fournir',
    tone: 'red',
    lead: 'Les RH attendent cette pièce.',
  },
  SUBMITTED: {
    label: 'Transmise',
    tone: 'blue',
    lead: 'Reçue, en attente de vérification par les RH.',
  },
  ACCEPTED: {
    label: 'Validée',
    tone: 'green',
    lead: 'Rien de plus à faire.',
  },
  REJECTED: {
    label: 'À refaire',
    tone: 'red',
    lead: 'Les RH ont besoin d’une nouvelle version.',
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/files');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  // Anchored on the caller: there is no id here that could name another person's file.
  const files = await prisma.personalFile
    .findMany({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { labelFr: 'asc' }],
      select: {
        id: true,
        labelFr: true,
        status: true,
        noteFr: true,
        submittedAt: true,
        reviewedAt: true,
      },
    })
    .catch(() => []);

  if (files.length === 0) {
    return (
      <EmptyState
        title="Mes pièces"
        description="Aucune pièce administrative ne vous est demandée pour l’instant."
      />
    );
  }

  const outstanding = files.filter(
    (file) => file.status === 'REQUESTED' || file.status === 'REJECTED',
  ).length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Les documents administratifs demandés par les RH : pièce d’identité, diplômes, RIB, certificat médical.">
          Mes pièces
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={files.length} label="Demandées" />
          <KpiTile
            value={files.filter((file) => file.status === 'ACCEPTED').length}
            label="Validées"
          />
          <KpiTile
            value={outstanding}
            label="En attente de vous"
            hint={outstanding === 0 ? 'Rien à faire' : 'À transmettre'}
          />
        </div>
      </section>

      <ul className="space-y-3">
        {files.map((file) => {
          const state = STATUS[file.status] ?? {
            label: file.status,
            tone: 'neutral' as StatusTone,
            lead: '',
          };

          return (
            <li key={file.id}>
              <Card accent={file.status === 'REQUESTED' || file.status === 'REJECTED' ? 'red' : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-text text-[13px] font-medium">{file.labelFr}</p>
                    <CardBody className="mt-0.5">{state.lead}</CardBody>

                    {file.noteFr ? (
                      <p className="text-text-dim mt-1 text-[11px]">Votre note : {file.noteFr}</p>
                    ) : null}
                    {file.submittedAt ? (
                      <p className="text-text-dim mt-0.5 font-mono text-[11px]">
                        Transmise le {formatDate(file.submittedAt, locale as Locale)}
                        {file.reviewedAt
                          ? ` · vérifiée le ${formatDate(file.reviewedAt, locale as Locale)}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge label={state.label} tone={state.tone} />
                    {file.status !== 'ACCEPTED' ? (
                      <SubmitFileForm
                        fileId={file.id}
                        label={file.labelFr}
                        storageConfigured={isStorageConfigured()}
                      />
                    ) : null}
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
