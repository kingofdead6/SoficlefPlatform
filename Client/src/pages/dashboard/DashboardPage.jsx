import { useEffect, useState } from 'react';

import { dashboardApi } from '../../api/dashboard.js';

const dash = (value) => (value === null || value === undefined ? '—' : value);

/** The role-aware KPI dashboard (/dashboard), ported from application/dashboard/kpis.ts. */
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: kpis } = await dashboardApi.kpis();
        setData(kpis);
      } catch {
        setError('Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  const tiles = [];
  if (data.onboarding) {
    tiles.push({ label: 'Parcours en cours', value: dash(data.onboarding.journeys) });
    tiles.push({ label: 'Tâches en retard', value: dash(data.onboarding.overdueTasks) });
    tiles.push({ label: 'Avancement moyen', value: `${dash(data.onboarding.averagePercent)}%` });
  }
  if (data.hr) {
    tiles.push({ label: 'Taux de complétion', value: data.hr.completionRate === null ? '—' : `${data.hr.completionRate}%` });
    tiles.push({ label: 'Délai moyen d’intégration', value: data.hr.averageOnboardingDays === null ? '—' : `${data.hr.averageOnboardingDays} j` });
    tiles.push({ label: 'Taux de confirmation', value: data.hr.confirmationRate === null ? '—' : `${data.hr.confirmationRate}%` });
    tiles.push({ label: 'Turnover 6 mois', value: data.hr.turnoverRate === null ? '—' : `${data.hr.turnoverRate}%` });
    tiles.push({ label: 'Satisfaction', value: data.hr.satisfaction === null ? '—' : `${data.hr.satisfaction}%` });
    tiles.push({ label: 'Taux de formation', value: data.hr.trainingRate === null ? '—' : `${data.hr.trainingRate}%` });
  }
  if (data.jobDescriptions) {
    tiles.push({ label: 'Couverture fiches de poste', value: `${dash(data.jobDescriptions.coverage)}%` });
  }
  if (data.competencies) {
    tiles.push({ label: 'Écarts critiques', value: dash(data.competencies.critical) });
  }
  if (data.quality) {
    tiles.push({ label: 'Structures sans responsable', value: dash(data.quality.unitsWithoutHead) });
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-1 font-display text-2xl text-red-deep">Pilotage</h1>
      <p className="mb-6 text-text-dim">Les indicateurs visibles dans votre périmètre.</p>

      {tiles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-app border border-dashed border-border text-text-dim">
          Aucun indicateur disponible pour votre profil.
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-app border border-border bg-surface p-4 shadow-app">
              <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">{tile.label}</p>
              <p className="font-display text-2xl text-red-deep">{tile.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
