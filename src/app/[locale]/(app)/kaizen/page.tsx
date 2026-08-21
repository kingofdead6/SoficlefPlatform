import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { KaizenActionStatus } from '@/components/kaizen/action-status';
import {
  Card,
  CardBody,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  SectionTitle,
  Tabs,
  Timeline,
} from '@/components/ui';
import type { TimelineEntry } from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020). This check was missing here
  // while every other module route carried it.
  const item = navItemByHref('/kaizen');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const mayEdit = can(user, 'update', 'kaizen_action');

  let programme: Awaited<ReturnType<typeof loadProgramme>> = null;

  try {
    programme = await loadProgramme();
  } catch (error) {
    console.error('Failed to load kaizen data:', error);
  }

  if (!programme) {
    return (
      <EmptyState
        title="Projet Kaizen"
        description="Le programme Kaizen n'est pas encore disponible."
      />
    );
  }

  const priorityEntries: TimelineEntry[] = programme.priorityActionsJ30.map((action) => ({
    id: action.id,
    marker: action.dayLabelFr,
    title: action.textFr,
  }));

  return (
    <div className="space-y-8">
      <Card accent="brand">
        <CardTitle>Pilote interne : {programme.internalLeadFr}</CardTitle>
        <CardBody className="text-text text-[13.5px]">{programme.programmeFr}</CardBody>
      </Card>

      {programme.missions.length > 0 && (
        <section>
          <SectionTitle>Missions</SectionTitle>
          <Tabs
            label="Missions Kaizen"
            items={programme.missions.map((mission) => ({
              value: mission.id,
              label: `${mission.icon ?? ''} Mission ${mission.number}`.trim(),
              content: <MissionPanel mission={mission} mayEdit={mayEdit} />,
            }))}
          />
        </section>
      )}

      {priorityEntries.length > 0 && (
        <section>
          <SectionTitle>Actions prioritaires — 30 premiers jours</SectionTitle>
          <Timeline entries={priorityEntries} label="Actions prioritaires 30 jours" />
        </section>
      )}
    </div>
  );
}

type Mission = NonNullable<Awaited<ReturnType<typeof loadProgramme>>>['missions'][number];

function MissionPanel({ mission, mayEdit }: { mission: Mission; mayEdit: boolean }) {
  const gapColumns: Column<Mission['gaps'][number]>[] = [
    { key: 'domain', header: 'Domaine', render: (row) => row.domainFr },
    { key: 'observed', header: 'Constat', render: (row) => row.observedFr },
    { key: 'target', header: 'Cible', render: (row) => row.targetFr },
  ];

  const actionColumns: Column<Mission['actions'][number]>[] = [
    { key: 'action', header: 'Action', render: (row) => row.actionFr },
    { key: 'owner', header: 'Responsable', render: (row) => row.ownerFr },
    {
      key: 'deadline',
      header: 'Échéance',
      align: 'end',
      mono: true,
      render: (row) => row.deadlineFr,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'end',
      render: (row) => (
        <KaizenActionStatus id={row.id} statusFr={row.statusFr} editable={mayEdit} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-text text-lg">{mission.titleFr}</h3>
        <p className="text-text-muted mt-1 text-[12.5px]">
          {mission.periodFr}
          {mission.referenceFr ? ` · ${mission.referenceFr}` : ''} · Pilote interne :{' '}
          {mission.internalLeadFr}
        </p>
        <p className="text-text mt-3 text-[13.5px]">{mission.contextFr}</p>
      </div>

      {mission.results.length > 0 && (
        <div>
          <h4 className="text-red-brand mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase">
            Résultats
          </h4>
          <ul className="list-disc space-y-1.5 ps-5">
            {mission.results.map((result) => (
              <li key={result.id} className="text-text text-[13px]">
                {result.textFr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mission.journal.length > 0 && (
        <div>
          <h4 className="text-red-brand mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase">
            Journal de mission
          </h4>
          <Timeline
            label={`Journal de la mission ${mission.number}`}
            entries={mission.journal.map((entry) => ({
              id: entry.id,
              marker: entry.dayFr,
              title: entry.activitiesFr,
              detail: entry.outcomeFr,
            }))}
          />
        </div>
      )}

      {mission.gaps.length > 0 && (
        <div>
          <h4 className="text-red-brand mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase">
            Écarts constatés
          </h4>
          <DataTable
            columns={gapColumns}
            rows={mission.gaps}
            getRowKey={(row) => row.id}
            caption={`Écarts — mission ${mission.number}`}
            emptyLabel="Aucun écart"
          />
        </div>
      )}

      {mission.actions.length > 0 && (
        <div>
          <h4 className="text-red-brand mb-2 text-[11px] font-semibold tracking-[0.09em] uppercase">
            Plan d&apos;actions
          </h4>
          <DataTable
            columns={actionColumns}
            rows={mission.actions}
            getRowKey={(row) => row.id}
            caption={`Plan d'actions — mission ${mission.number}`}
            emptyLabel="Aucune action"
          />
        </div>
      )}
    </div>
  );
}

async function loadProgramme() {
  return prisma.kaizenProgramme.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      priorityActionsJ30: { orderBy: { order: 'asc' } },
      missions: {
        orderBy: { number: 'asc' },
        include: {
          results: { orderBy: { order: 'asc' } },
          journal: { orderBy: { order: 'asc' } },
          gaps: { orderBy: { order: 'asc' } },
          actions: { orderBy: { order: 'asc' } },
        },
      },
    },
  });
}
