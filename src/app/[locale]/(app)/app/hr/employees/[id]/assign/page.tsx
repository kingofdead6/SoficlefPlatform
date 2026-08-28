import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadEmployee } from '@/application/hr/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import { listVacantPositions } from '@/application/organization/assignments';
import { AssignPositionForm } from '@/components/hr/assign-position-form';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Giving one account a post (`/app/hr/employees/[id]/assign`).
 *
 * A full page rather than the dialog used from the queue: assigning is the act that turns
 * a dormant account into a working one, and it deserves room to show what is being
 * decided — which seat, under whom, from when, and which path it starts.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Gated on the queue's own permission: this page performs the same act.
  const item = navItemByHref('/app/hr/employees/unassigned');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const person = await loadEmployee(user, id).catch(() => null);
  if (!person) notFound();

  const [positions, templates, managers] = await Promise.all([
    listVacantPositions(user).catch(() => []),
    prisma.onboardingTemplate
      .findMany({ select: { id: true, titleFr: true }, orderBy: { titleFr: 'asc' } })
      .catch(() => []),
    prisma.user
      .findMany({
        where: { lifecycleState: 'ASSIGNED', status: 'ACTIVE', id: { not: person.id } },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
      })
      .catch(() => []),
  ]);

  const current = person.assignments.find((assignment) => assignment.endDate === null) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/hr/employees/unassigned" className="text-text-muted text-[12px]">
          ← Comptes à affecter
        </Link>
        <SectionTitle className="mt-2" lead={person.email}>
          Affecter {person.displayName}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={current ? 'Déjà en poste' : 'Sans poste'}
            tone={current ? 'green' : 'red'}
          />
          {person.hireDate ? (
            <span className="text-text-muted font-mono text-[11px]">
              Embauche · {formatDate(person.hireDate, locale as Locale)}
            </span>
          ) : null}
        </div>
      </div>

      {current ? (
        <Card accent="red">
          <CardTitle>Cette personne occupe déjà un poste</CardTitle>
          <CardBody className="mt-1">
            {current.position.titleFr}, depuis le{' '}
            {formatDate(current.startDate, locale as Locale)}. Une nouvelle affectation
            clôturera celle-ci à la date de prise de poste — rien n’est supprimé, l’historique
            reste lisible.
          </CardBody>
        </Card>
      ) : null}

      <AssignPositionForm
        userId={person.id}
        positions={positions}
        templates={templates}
        managers={managers}
        defaultStartDate={
          person.hireDate ? person.hireDate.toISOString().slice(0, 10) : undefined
        }
      />
    </div>
  );
}
