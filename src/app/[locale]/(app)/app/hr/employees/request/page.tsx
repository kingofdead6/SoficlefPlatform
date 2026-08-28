import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { listAccountRequests } from '@/application/organization/assignments';
import { RequestAccountForm } from '@/components/hr/request-account-form';
import { Card, CardBody, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Asking SI for an account (`/app/hr/employees/request`).
 *
 * The list below is the other half of the same screen: a request nobody can see the state
 * of is a request that gets sent twice.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/employees/unassigned');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const requests = await listAccountRequests(user).catch(() => []);

  return (
    <div className="space-y-10">
      <section>
        <Link href="/app/hr/employees/unassigned" className="text-text-muted text-[12px]">
          ← Comptes à affecter
        </Link>
        <SectionTitle
          className="mt-2"
          lead="Les RH ne créent pas les comptes : elles les demandent, l’informatique les crée, puis les RH donnent le poste. Aucun des deux services ne peut faire les deux."
        >
          Demander un compte
        </SectionTitle>

        <RequestAccountForm />
      </section>

      <section>
        <SectionTitle level={2}>Demandes en cours</SectionTitle>

        {requests.length === 0 ? (
          <Card>
            <CardBody>Aucune demande enregistrée.</CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => {
              const age = request.waitingDays;
              const open = request.status === 'OPEN';

              return (
                <li key={request.id}>
                  <Card accent={open && (age > 3 || request.urgency === 'URGENT') ? 'red' : undefined}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-text text-[13px] font-medium">
                          {request.candidateNameFr}
                        </p>
                        <p className="text-text-muted text-[12px]">
                          {request.plannedPositionFr}
                        </p>
                        <p className="text-text-dim mt-1 font-mono text-[11px]">
                          Demandé le {formatDate(request.createdAt, locale as Locale)}
                          {open ? ` · ${age} jour${age > 1 ? 's' : ''} d’attente` : ''}
                          {request.plannedHireDate
                            ? ` · embauche prévue ${formatDate(request.plannedHireDate, locale as Locale)}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge
                          label={
                            request.status === 'OPEN'
                              ? 'En attente de l’informatique'
                              : request.status === 'CREATED'
                                ? 'Compte créé'
                                : 'Refusée'
                          }
                          tone={
                            request.status === 'CREATED'
                              ? 'green'
                              : request.status === 'REJECTED'
                                ? 'neutral'
                                : 'red'
                          }
                        />
                        {request.urgency === 'URGENT' && open ? (
                          <StatusBadge label="Urgente" tone="red" />
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
