import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadMeOverview, type Phase } from '@/application/me/overview';
import { canOpen } from '@/application/navigation/build-navigation';
import { ProgressRing } from '@/components/me/progress-ring';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import {
  Card,
  CardBody,
  CardTitle,
  KpiTile,
  SectionTitle,
  StatusBadge,
  type StatusTone,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The new arrival's landing page (CDC-2026 §4, `/app/me`).
 *
 * Answers the four questions somebody in their first weeks actually has: how far along am
 * I, what is next, what phase am I in, and who do I ask. Everything else in `/app/me` is
 * reachable from here in one click.
 */

const PHASE: Record<Phase, { label: string; tone: StatusTone; lead: string }> = {
  PRE_ONBOARDING: {
    label: 'Pré-intégration',
    tone: 'neutral',
    lead: 'Votre poste se prépare. Les premières tâches vous attendent avant votre arrivée.',
  },
  DAY_ONE: {
    label: 'Premier jour',
    tone: 'brand',
    lead: 'Bienvenue. Voici ce qui est prévu aujourd’hui.',
  },
  PROBATION: {
    label: 'Période d’essai',
    tone: 'brand',
    lead: 'Votre intégration se poursuit sur 90 jours, jalonnée d’enquêtes et d’un point à J+30.',
  },
  COMPLETED: {
    label: 'Parcours terminé',
    tone: 'green',
    lead: 'Toutes vos étapes sont faites. Vos formations et documents restent accessibles.',
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020).
  const item = navItemByHref('/app/me');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const me = await loadMeOverview(user);
  const phase = PHASE[me.phase];

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead={phase.lead}>Bonjour {me.displayName.split(' ')[0]}</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={phase.label} tone={phase.tone} />
          {me.dayNumber !== null ? (
            <span className="text-text-muted font-mono text-[12px]">
              {me.dayNumber < 0
                ? `J${me.dayNumber} — arrivée le ${me.startDate ? formatDate(me.startDate, locale as Locale) : ''}`
                : `Jour ${me.dayNumber} de votre intégration`}
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card>
          <div className="flex items-center gap-5">
            <ProgressRing percent={me.progress.percent} />
            <div>
              <p className="text-text text-[13px] font-medium">Parcours d’intégration</p>
              <p className="text-text-muted text-[12px]">
                {me.progress.done} étape{me.progress.done > 1 ? 's' : ''} sur{' '}
                {me.progress.total}
              </p>
              <Link
                href="/app/me/journey"
                className="text-red-strong mt-2 inline-block text-[12px] font-medium"
              >
                Voir mon parcours →
              </Link>
            </div>
          </div>
        </Card>

        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StaggerItem>
            <KpiTile
              value={me.overdueCount}
              label="En retard"
              hint={me.overdueCount === 0 ? 'Rien à rattraper' : 'À traiter en priorité'}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={me.openSurveys} label="Enquêtes à remplir" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={me.trainingOutstanding} label="Formations obligatoires" />
          </StaggerItem>
        </Stagger>
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="Les trois prochaines étapes, par échéance. Le parcours complet reste consultable."
        >
          À faire ensuite
        </SectionTitle>

        {me.nextTasks.length === 0 ? (
          <Card>
            <CardBody>
              {me.progress.total === 0
                ? 'Votre parcours n’a pas encore été ouvert. Les RH s’en chargent avant votre arrivée.'
                : 'Rien en attente — toutes vos étapes sont faites.'}
            </CardBody>
          </Card>
        ) : (
          <Stagger as="ul" className="space-y-3">
            {me.nextTasks.map((task) => (
              <StaggerItem as="li" key={task.milestoneId}>
                <Card accent={task.overdue ? 'red' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{task.titleFr}</CardTitle>
                      <CardBody className="mt-1">{task.detailFr}</CardBody>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
                        {task.dayLabelFr}
                      </span>
                      {task.overdue ? (
                        <StatusBadge label="En retard" tone="red" />
                      ) : task.dueSoon ? (
                        <StatusBadge label="Bientôt" tone="blue" />
                      ) : null}
                      {task.dueDate ? (
                        <span className="text-text-dim font-mono text-[11px]">
                          {formatDate(task.dueDate, locale as Locale)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    href={`/app/me/journey/${task.milestoneId}`}
                    className="text-red-strong mt-3 inline-block text-[12px] font-medium"
                  >
                    Ouvrir la tâche →
                  </Link>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <section>
        <SectionTitle level={2}>Qui contacter</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Mon responsable</CardTitle>
            {me.manager ? (
              <>
                <CardBody className="mt-1">{me.manager.displayName}</CardBody>
                <p className="text-text-dim font-mono text-[11px]">
                  {me.manager.email}
                  {me.manager.phone ? ` · poste ${me.manager.phone}` : ''}
                </p>
              </>
            ) : (
              <CardBody className="mt-1">
                Aucun responsable enregistré. Les RH peuvent le renseigner.
              </CardBody>
            )}
          </Card>

          <Card>
            <CardTitle>Ressources humaines</CardTitle>
            {me.hrContact ? (
              <>
                <CardBody className="mt-1">{me.hrContact.nameFr}</CardBody>
                <p className="text-text-dim font-mono text-[11px]">
                  {me.hrContact.roleFr} · poste {me.hrContact.extension}
                </p>
              </>
            ) : (
              <CardBody className="mt-1">Voir l’annuaire des interlocuteurs.</CardBody>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
