import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { dashboardApi } from '../../api/dashboard.js';

const dash = (value) => (value === null || value === undefined ? '—' : value);

/** The role-aware KPI dashboard (/dashboard), ported from application/dashboard/kpis.ts. */
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const { data: kpis } = await dashboardApi.kpis();
        setData(kpis);
      } catch {
        setError('load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{t('onboarding.dashboard.loadFailed')}</div>;

  const tiles = [];
  if (data.onboarding) {
    tiles.push({ label: t('onboarding.dashboard.tiles.journeys'), value: dash(data.onboarding.journeys) });
    tiles.push({ label: t('onboarding.dashboard.tiles.overdueTasks'), value: dash(data.onboarding.overdueTasks) });
    tiles.push({
      label: t('onboarding.dashboard.tiles.averagePercent'),
      value: `${dash(data.onboarding.averagePercent)}%`,
    });
  }
  if (data.hr) {
    tiles.push({
      label: t('onboarding.dashboard.tiles.completionRate'),
      value: data.hr.completionRate === null ? '—' : `${data.hr.completionRate}%`,
    });
    tiles.push({
      label: t('onboarding.dashboard.tiles.averageOnboardingDays'),
      value:
        data.hr.averageOnboardingDays === null
          ? '—'
          : t('onboarding.dashboard.daysSuffix', { count: data.hr.averageOnboardingDays }),
    });
    tiles.push({
      label: t('onboarding.dashboard.tiles.confirmationRate'),
      value: data.hr.confirmationRate === null ? '—' : `${data.hr.confirmationRate}%`,
    });
    tiles.push({
      label: t('onboarding.dashboard.tiles.turnover'),
      value: data.hr.turnoverRate === null ? '—' : `${data.hr.turnoverRate}%`,
    });
    tiles.push({
      label: t('onboarding.dashboard.tiles.satisfaction'),
      value: data.hr.satisfaction === null ? '—' : `${data.hr.satisfaction}%`,
    });
    tiles.push({
      label: t('onboarding.dashboard.tiles.trainingRate'),
      value: data.hr.trainingRate === null ? '—' : `${data.hr.trainingRate}%`,
    });
  }
  if (data.jobDescriptions) {
    tiles.push({
      label: t('onboarding.dashboard.tiles.jobDescriptionCoverage'),
      value: `${dash(data.jobDescriptions.coverage)}%`,
    });
  }
  if (data.competencies) {
    tiles.push({ label: t('onboarding.dashboard.tiles.criticalGaps'), value: dash(data.competencies.critical) });
  }
  if (data.quality) {
    tiles.push({
      label: t('onboarding.dashboard.tiles.unitsWithoutHead'),
      value: dash(data.quality.unitsWithoutHead),
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-1 font-display text-2xl text-red-deep">{t('onboarding.dashboard.title')}</h1>
      <p className="mb-6 text-text-dim">{t('onboarding.dashboard.subtitle')}</p>

      {tiles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-app border border-dashed border-border text-text-dim">
          {t('onboarding.dashboard.empty')}
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
