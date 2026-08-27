import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import {
  listAssignments,
  listPendingAccounts,
  listVacantPositions,
} from '@/application/organization/assignments';
import { canOpen } from '@/application/navigation/build-navigation';
import { AssignPositionDialog } from '@/components/hr/assign-position-dialog';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import {
  Card,
  CardBody,
  DataTable,
  EmptyState,
  KpiTile,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Personnel administration — HR's half of the provisioning chain (CDC-2026 Module 1).
 *
 * The queue at the top is the point of the screen: accounts SI has created that nobody has
 * placed yet. Until HR gives one a post it reaches `/pending` and nothing else, so an
 * account sitting in this list is a person who cannot work.
 *
 * Creating and deleting accounts is deliberately *not* here — that is `/admin`, and it
 * belongs to SI. Neither role can put a working account into the platform alone.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020).
  const item = navItemByHref('/hr');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [pending, vacancies, assignments, templates] = await Promise.all([
    listPendingAccounts(user).catch(() => []),
    listVacantPositions(user).catch(() => []),
    listAssignments(user).catch(() => []),
    prisma.onboardingTemplate
      .findMany({ select: { id: true, titleFr: true }, orderBy: { titleFr: 'asc' } })
      .catch(() => []),
  ]);

  const assignmentColumns: Column<(typeof assignments)[number]>[] = [
    {
      key: 'person',
      header: 'Collaborateur',
      render: (row) => (
        <>
          <span className="font-medium">{row.user.displayName}</span>
          <span className="text-text-dim block text-[11px]">{row.user.email}</span>
        </>
      ),
    },
    { key: 'position', header: 'Poste', render: (row) => row.position.titleFr },
    {
      key: 'since',
      header: 'Depuis',
      align: 'end',
      mono: true,
      render: (row) => formatDate(row.startDate, locale as Locale),
    },
  ];

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Le compte est créé par l’informatique, le poste est donné par les RH. Tant que cette affectation n’est pas faite, la personne ne voit qu’un message d’attente.">
          Comptes en attente d’affectation
        </SectionTitle>

        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <KpiTile
              value={pending.length}
              label="En attente"
              hint={pending.length > 0 ? 'À affecter' : 'Rien à traiter'}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={vacancies.length} label="Postes vacants" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={assignments.length} label="Affectations en cours" />
          </StaggerItem>
        </Stagger>

        {pending.length === 0 ? (
          <Card className="mt-4">
            <CardBody>
              Aucun compte en attente : toute personne disposant d’un compte occupe un poste.
            </CardBody>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((account) => (
              <li key={account.id}>
                <Card accent="red">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-text text-[13px] font-medium">{account.displayName}</p>
                      <p className="text-text-dim text-[11px]">{account.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge label="Sans poste" tone="red" />
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
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle lead="Une réaffectation ne supprime rien : l’affectation en cours est close à sa date, et l’historique reste lisible.">
          Affectations en cours
        </SectionTitle>

        {assignments.length === 0 ? (
          <EmptyState
            title="Affectations"
            description="Aucune affectation dans votre périmètre."
          />
        ) : (
          <DataTable
            columns={assignmentColumns}
            rows={assignments}
            getRowKey={(row) => row.id}
            emptyLabel="Aucune affectation."
            caption="Affectations en cours"
          />
        )}
      </section>
    </div>
  );
}
