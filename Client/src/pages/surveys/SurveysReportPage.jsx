import { useEffect, useState } from 'react';

import { surveysApi } from '../../api/surveys.js';

const INDICATOR_LABELS = {
  WELCOME_QUALITY: "Qualité de l'accueil",
  SUPPORT_LEVEL: 'Accompagnement',
  ROLE_CLARITY: 'Clarté du rôle',
  MANAGER_RELATIONSHIP: 'Relation avec le manager',
  WORKING_CONDITIONS: 'Conditions de travail',
};

/** The aggregate satisfaction report — counts and averages only, never individual answers. */
export default function SurveysReportPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await surveysApi.satisfaction();
        setSummary(data);
      } catch {
        setError('Impossible de charger les enquêtes de satisfaction.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Enquêtes de satisfaction</h1>
      <p className="mb-6 text-text-dim">Résultats agrégés — aucune réponse individuelle n'est affichée ici.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Score" value={summary.score === null ? '—' : `${summary.score}%`} />
        <StatTile label="Taux de réponse" value={summary.responseRate === null ? '—' : `${summary.responseRate}%`} />
        <StatTile label="Enquêtes envoyées" value={summary.roundsIssued} />
        <StatTile label="En retard" value={summary.roundsOverdue} />
      </div>

      <div className="mb-6 overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-2 font-medium">Indicateur</th>
              <th className="px-4 py-2 font-medium">Moyenne</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Réponses</th>
            </tr>
          </thead>
          <tbody>
            {summary.indicators.map((indicator) => (
              <tr key={indicator.indicator} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text">{INDICATOR_LABELS[indicator.indicator] ?? indicator.indicator}</td>
                <td className="px-4 py-2 text-text-dim">{indicator.average ?? '—'}</td>
                <td className="px-4 py-2 text-text-dim">{indicator.percent === null ? '—' : `${indicator.percent}%`}</td>
                <td className="px-4 py-2 text-text-dim">{indicator.responses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-2 font-medium">Jalon</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Réponses</th>
            </tr>
          </thead>
          <tbody>
            {summary.byMilestone.map((milestone) => (
              <tr key={milestone.dayOffset} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text">J+{milestone.dayOffset}</td>
                <td className="px-4 py-2 text-text-dim">{milestone.score === null ? '—' : `${milestone.score}%`}</td>
                <td className="px-4 py-2 text-text-dim">{milestone.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-app border border-border bg-surface p-4 shadow-app">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </div>
  );
}
