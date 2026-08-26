import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { loadMyRounds, loadSatisfaction } from '@/application/survey/rounds';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { SurveyForm } from '@/components/survey/survey-form';
import {
  Card,
  CardBody,
  DataTable,
  KpiTile,
  ProgressBar,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { IndicatorBreakdown } from '@/domain/survey/satisfaction';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Satisfaction surveys (CDC-2026 Module 9) and the score §10 reports.
 *
 * Two audiences on one page, and the split matters: a collaborator sees their own rounds
 * and can answer them; everybody else sees aggregates only. Nobody but the author ever
 * sees an individual answer, which is what makes an honest answer possible.
 */

const INDICATOR_LABELS: Record<string, string> = {
  WELCOME_QUALITY: "Qualité de l'accueil",
  SUPPORT_LEVEL: "Niveau de l'accompagnement",
  ROLE_CLARITY: 'Compréhension du poste',
  MANAGER_RELATIONSHIP: 'Relationnel manager',
  WORKING_CONDITIONS: 'Conditions de travail',
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/surveys');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const t = await getTranslations();

  const [mine, summary] = await Promise.all([
    // Only somebody who may answer has rounds of their own to fetch.
    can(user, 'update', 'survey', { ownerUserId: user.id })
      ? loadMyRounds(user).catch(() => [])
      : Promise.resolve([]),
    loadSatisfaction(user).catch((error) => {
      console.error('Failed to load satisfaction data:', error);
      return null;
    }),
  ]);

  if (mine.length === 0 && (!summary || summary.roundsIssued === 0)) {
    return (
      <Card>
        <CardBody>{t('empty.surveys')}</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {mine.length > 0 ? <MyRounds rounds={mine} locale={locale as Locale} /> : null}
      {summary && summary.roundsIssued > 0 ? (
        <Aggregate summary={summary} showsOthers={mine.length === 0} />
      ) : null}
    </div>
  );
}

function MyRounds({
  rounds,
  locale,
}: {
  rounds: Awaited<ReturnType<typeof loadMyRounds>>;
  locale: Locale;
}) {
  return (
    <section>
      <SectionTitle lead="Quatre enquêtes jalonnent votre intégration : à J+7, J+30, J+60 et J+90. Vos réponses ne sont lues qu'agrégées — personne ne voit qui a répondu quoi.">
        Mes enquêtes
      </SectionTitle>

      <Stagger as="ul" className="space-y-3">
        {rounds.map((round) => (
          <StaggerItem as="li" key={round.id}>
            <Card accent={round.overdue ? 'red' : undefined}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
                  J+{round.dayOffset}
                </span>
                {round.answeredAt ? (
                  <StatusBadge
                    label={`Renseignée le ${formatDate(round.answeredAt, locale)}`}
                    tone="green"
                  />
                ) : round.overdue ? (
                  <StatusBadge label="En retard" tone="red" />
                ) : round.open ? (
                  <StatusBadge label="À renseigner" tone="brand" />
                ) : (
                  <StatusBadge label="Pas encore ouverte" tone="neutral" />
                )}
                <span className="text-text-dim font-mono text-[11px]">
                  Échéance · {formatDate(round.dueDate, locale)}
                </span>
              </div>

              {round.answeredAt ? (
                <CardBody className="mt-2">
                  Merci — cette enquête est enregistrée. Elle alimente le score de
                  satisfaction consolidé.
                </CardBody>
              ) : round.open ? (
                <div className="mt-4">
                  <SurveyForm roundId={round.id} dayOffset={round.dayOffset} />
                </div>
              ) : (
                <CardBody className="mt-2">
                  Elle s&apos;ouvrira à son échéance : une intégration ne peut pas être notée
                  avant d&apos;avoir eu lieu.
                </CardBody>
              )}
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Aggregate({
  summary,
  showsOthers,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof loadSatisfaction>>>;
  showsOthers: boolean;
}) {
  const columns: Column<IndicatorBreakdown>[] = [
    {
      key: 'indicator',
      header: 'Indicateur',
      render: (row) => INDICATOR_LABELS[row.indicator] ?? row.indicator,
    },
    {
      key: 'average',
      header: 'Moyenne',
      align: 'end',
      mono: true,
      render: (row) => (row.average === null ? '—' : `${row.average} / 5`),
    },
    {
      key: 'percent',
      header: 'Score',
      align: 'end',
      mono: true,
      render: (row) => (row.percent === null ? '—' : `${row.percent}%`),
    },
    {
      key: 'responses',
      header: 'Réponses',
      align: 'end',
      mono: true,
      render: (row) => row.responses,
    },
  ];

  return (
    <section>
      <SectionTitle
        lead={
          showsOthers
            ? 'Le score consolidé de votre périmètre. Les réponses individuelles ne sont pas consultables.'
            : 'Le score consolidé, tel qu’il alimente le tableau de bord RH.'
        }
      >
        Satisfaction consolidée
      </SectionTitle>

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <KpiTile
            value={summary.score === null ? '—' : `${summary.score}%`}
            label="Score global"
            hint="Objectif ≥ 85%"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            value={summary.responseRate === null ? '—' : `${summary.responseRate}%`}
            label="Taux de réponse"
            hint={`${summary.roundsAnswered}/${summary.roundsIssued} enquêtes`}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile value={summary.roundsOverdue} label="En retard" />
        </StaggerItem>
        <StaggerItem>
          <KpiTile value={summary.roundsIssued} label="Enquêtes émises" />
        </StaggerItem>
      </Stagger>

      {summary.score !== null ? (
        <ProgressBar
          className="mt-4"
          value={summary.score}
          label="Score de satisfaction — plancher de recette 85%"
        />
      ) : null}

      <div className="mt-6">
        <SectionTitle level={3}>Par indicateur</SectionTitle>
        <DataTable
          columns={columns}
          rows={summary.indicators}
          getRowKey={(row) => row.indicator}
          emptyLabel="Aucune réponse."
          caption="Satisfaction par indicateur"
        />
      </div>

      <div className="mt-6">
        <SectionTitle level={3} lead="Un score qui baisse entre deux jalons est le signal le plus utile de cette page.">
          Par jalon
        </SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summary.byMilestone.map((milestone) => (
            <KpiTile
              key={milestone.dayOffset}
              value={milestone.score === null ? '—' : `${milestone.score}%`}
              label={`J+${milestone.dayOffset}`}
              hint={`${milestone.answered} réponse(s)`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
