import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import {
  listPendingAccounts,
  listVacantPositions,
} from '@/application/organization/assignments';
import { AssignPositionDialog } from '@/components/hr/assign-position-dialog';
import { Card, CardBody, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Accounts waiting for a post (`/app/hr/employees/unassigned`).
 *
 * Sorted oldest first, deliberately: a queue ordered by name lets somebody sit in limbo
 * indefinitely because they happen to start with Z. The age is shown in days for the same
 * reason — "created 12 days ago" prompts action in a way a date does not.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/employees/unassigned');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [pending, vacancies, templates] = await Promise.all([
    listPendingAccounts(user).catch(() => []),
    listVacantPositions(user).catch(() => []),
    prisma.onboardingTemplate
      .findMany({ select: { id: true, titleFr: true }, orderBy: { titleFr: 'asc' } })
      .catch(() => []),
  ]);



  return (
    <div className="space-y-8">
      <SectionTitle lead="L’informatique crée le compte, les RH donnent le poste. Tant que l’affectation n’est pas faite, la personne ne voit qu’un message d’attente et ne peut pas travailler.">
        Comptes à affecter
      </SectionTitle>

      {pending.length === 0 ? (
        <Card>
          <CardBody>
            Aucun compte en attente : toute personne disposant d’un compte occupe un poste.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {pending.map((account) => {
            const age = account.waitingDays;

            return (
              <li key={account.id}>
                <Card accent="red">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-text text-[13px] font-medium">{account.displayName}</p>
                      <p className="text-text-dim text-[11px]">{account.email}</p>
                      <p className="text-text-muted mt-1 font-mono text-[11px]">
                        Créé le {formatDate(account.createdAt, locale as Locale)} · {age} jour
                        {age > 1 ? 's' : ''} d’attente
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Past a week the wait itself is the problem, so it is said louder. */}
                      <StatusBadge
                        label={age > 7 ? `${age} jours sans poste` : 'Sans poste'}
                        tone="red"
                      />
                      <AssignPositionDialog
                        userId={account.id}
                        userName={account.displayName}
                        positions={vacancies}
                        templates={templates}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
