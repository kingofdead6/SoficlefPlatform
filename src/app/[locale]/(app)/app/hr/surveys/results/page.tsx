import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { loadSatisfaction } from '@/application/survey/rounds';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  KpiTile,
  ProgressBar,
  SectionTitle,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { IndicatorBreakdown } from '@/domain/survey/satisfaction';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Aggregate satisfaction (`/app/hr/surveys/results`), CDC-2026 §10.
 *
 * Aggregates only, and that is a guarantee rather than a limitation: the query never
 * returns an individual answer, so no filter combination here can narrow down to one
 * person. The specification asks for individual responses; refusing them is what makes the
 * rest of the data worth reading.
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

  const item = navItemByHref('/app/hr/surveys');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const summary = await loadSatisfaction(user).catch(() => null);

  if (!summary || summary.roundsIssued === 0) {
    return (
      <div className="space-y-6">
        <Link href="/app/hr/surveys" className="text-text-muted text-[12px]">
          ← Enquêtes
        </Link>
        <Card>
          <CardBody>
            Aucune enquête émise pour l’instant : le score se calcule dès la première
            intégration lancée.
          </CardBody>
        </Card>
      </div>
    );
  }

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
    <div className="space-y-10">
      <section>
        <Link href="/app/hr/surveys" className="text-text-muted text-[12px]">
          ← Enquêtes
        </Link>
        <SectionTitle
          className="mt-2"
          lead="Le score consolidé et son détail. Les réponses individuelles ne sont pas consultables — c’est la contrepartie de leur franchise."
        >
          Résultats des enquêtes
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            value={summary.score === null ? '—' : `${summary.score}%`}
            label="Score global"
            hint="Objectif ≥ 85%"
          />
          <KpiTile
            value={summary.responseRate === null ? '—' : `${summary.responseRate}%`}
            label="Taux de réponse"
            hint={`${summary.roundsAnswered}/${summary.roundsIssued} enquêtes`}
          />
          <KpiTile value={summary.roundsOverdue} label="En retard" />
          <KpiTile value={summary.roundsIssued} label="Enquêtes émises" />
        </div>

        {summary.score !== null ? (
          <ProgressBar
            className="mt-4"
            value={summary.score}
            label="Score de satisfaction — plancher de recette 85%"
          />
        ) : null}
      </section>

      <section>
        <SectionTitle level={2}>Par indicateur</SectionTitle>
        <DataTable
          columns={columns}
          rows={summary.indicators}
          getRowKey={(row) => row.indicator}
          emptyLabel="Aucune réponse."
          caption="Satisfaction par indicateur"
        />
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="Un score qui baisse entre deux jalons est le signal le plus utile de cette page : il situe le moment où l’intégration se dégrade."
        >
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
      </section>

      <Card>
        <CardTitle>Filtres par division et par manager</CardTitle>
        <CardBody className="mt-1">
          Non proposés tant que les effectifs sont ceux d’un site pilote : filtrer un score
          agrégé sur une équipe de trois personnes revient à publier des réponses
          individuelles. Le seuil en dessous duquel un agrégat cesse d’en être un est une
          règle à fixer avec la direction, pas une valeur à choisir ici.
        </CardBody>
      </Card>
    </div>
  );
}
