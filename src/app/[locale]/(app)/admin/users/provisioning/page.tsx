import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadProvisioningQueue } from '@/application/admin/console';
import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Both sides of the handoff (`/admin/users/provisioning`).
 *
 * HR asks, SI creates, HR places. One screen because it is one relay: split across two,
 * each side looks clear while somebody sits between them unable to work.
 *
 * The right-hand column is deliberately not actionable from here. An administrator can see
 * that an account has been waiting eleven days for a post, and cannot give it one — that is
 * the whole point of the separation, and a button here would quietly undo it.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/users');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const { requests, unplaced } = await loadProvisioningQueue(user);

  const stale = [...requests, ...unplaced].filter((row) => row.waitingDays > 3).length;

  return (
    <div className="space-y-10">
      <section>
        <Link href="/admin/users" className="text-text-muted text-[12px]">
          ← Comptes
        </Link>
        <SectionTitle
          className="mt-2"
          lead="Les RH demandent un compte, l’informatique le crée, les RH lui donnent un poste. Tant que le relais n’est pas terminé, la personne ne peut pas travailler."
        >
          File d’habilitation
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile
            value={requests.length}
            label="À créer"
            hint={requests.length > 0 ? 'Votre action' : 'Rien à faire'}
          />
          <KpiTile
            value={unplaced.length}
            label="À affecter"
            hint={unplaced.length > 0 ? 'Action RH' : 'Rien en attente'}
          />
          <KpiTile
            value={stale}
            label="Depuis plus de 3 jours"
            hint={stale > 0 ? 'À relancer' : undefined}
          />
        </div>
      </section>

      <section>
        <SectionTitle level={2} lead="Demandes des RH en attente de création. C’est votre moitié du relais.">
          Comptes à créer
        </SectionTitle>

        {requests.length === 0 ? (
          <Card>
            <CardBody>Aucune demande en attente.</CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card
                  accent={
                    request.waitingDays > 3 || request.urgency === 'URGENT' ? 'red' : undefined
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{request.candidateNameFr}</CardTitle>
                      <CardBody className="mt-1">{request.plannedPositionFr}</CardBody>
                      <p className="text-text-dim mt-1 font-mono text-[11px]">
                        Demandé par {request.requestedBy.displayName} le{' '}
                        {formatDate(request.createdAt, locale as Locale)} ·{' '}
                        {request.waitingDays} jour(s) d’attente
                        {request.plannedHireDate
                          ? ` · embauche prévue ${formatDate(request.plannedHireDate, locale as Locale)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {request.urgency === 'URGENT' ? (
                        <StatusBadge label="Urgente" tone="red" />
                      ) : null}
                      <StatusBadge label="À créer" tone="red" />
                    </div>
                  </div>
                  <p className="text-text-dim mt-3 text-[11px]">
                    Créez le compte depuis l’écran des comptes, puis les RH l’affecteront.
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="Comptes créés que personne n’a encore affectés. Vous ne pouvez pas les affecter vous-même : c’est la séparation qui fait que nul ne met seul un compte en service."
        >
          Comptes à affecter par les RH
        </SectionTitle>

        {unplaced.length === 0 ? (
          <Card>
            <CardBody>Aucun compte en attente d’affectation.</CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {unplaced.map((account) => (
              <li key={account.id}>
                <Card accent={account.waitingDays > 3 ? 'red' : undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-text text-[13px] font-medium">{account.displayName}</p>
                      <p className="text-text-dim text-[11px]">{account.email}</p>
                      <p className="text-text-muted mt-1 font-mono text-[11px]">
                        Créé le {formatDate(account.createdAt, locale as Locale)} ·{' '}
                        {account.waitingDays} jour(s) sans poste
                      </p>
                    </div>
                    <StatusBadge label="En attente des RH" tone="blue" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
