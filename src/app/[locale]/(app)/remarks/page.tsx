import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { DeleteRemarkButton } from '@/components/remarks/remark-actions';
import { RemarkComposer } from '@/components/remarks/remark-composer';
import { Card, CardBody, SectionTitle } from '@/components/ui';
import { can, scopeFilterFor } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * The remarks and recommendations journal (CDC v1 §3.7).
 *
 * The prototype stored these in `localStorage`, so they never reached the DRH they were
 * addressed to. Here each entry is a scoped row with an audited export.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/remarks');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const scope = scopeFilterFor(user, 'read', 'remark');
  const remarks =
    scope.kind === 'none'
      ? []
      : await prisma.remark
          .findMany({
            where: scope.kind === 'self' ? { authorId: user.id } : {},
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, displayName: true } } },
          })
          .catch((error) => {
            console.error('Failed to load remarks:', error);
            return [];
          });

  // The author's own journal entry: a SELF-scoped assignment only covers rows they own,
  // so the target must name them. Asking without a target would answer "no" for the very
  // person the journal belongs to.
  const mayWrite = can(user, 'create', 'remark', { ownerUserId: user.id });

  return (
    <div className="space-y-8">
      {mayWrite ? (
        <section>
          <SectionTitle lead="Vos observations de terrain, à l'attention de la Direction des Ressources Humaines et de la Direction Générale. Chaque remarque est horodatée.">
            Déposer une remarque
          </SectionTitle>
          <Card>
            <RemarkComposer />
          </Card>
        </section>
      ) : null}

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle className="mb-0" lead={`${remarks.length} remarque(s) enregistrée(s).`}>
            Journal
          </SectionTitle>
          {remarks.length > 0 ? (
            /* A file download, not a route transition: next/link would prefetch the
               export and hand the response to the client router instead of saving it. */
            <a
              href="/api/v1/remarks/export"
              download
              className="text-text-muted rounded border border-(--border) bg-(--surface2) px-3 py-1.5 text-[12px]"
            >
              Exporter en texte
            </a>
          ) : null}
        </div>

        {remarks.length === 0 ? (
          <Card>
            <CardBody>
              Aucune remarque n&apos;a encore été consignée.
              {mayWrite ? ' Utilisez le formulaire ci-dessus pour en déposer une.' : ''}
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {remarks.map((remark) => (
              <li
                key={remark.id}
                className="rounded-(--radius) border border-s-4 border-(--border) border-s-(--gold-accent) bg-(--surface) px-4 py-3"
              >
                <p className="text-text text-[13px] whitespace-pre-wrap">{remark.contentFr}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-text-dim font-mono text-[11px]">
                    {formatDate(remark.createdAt, locale as Locale, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {remark.author.displayName}
                  </span>
                  {remark.author.id === user.id ? <DeleteRemarkButton id={remark.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
