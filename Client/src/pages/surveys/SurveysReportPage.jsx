import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { surveysApi } from '../../api/surveys.js';

/** API indicator codes → catalogue keys. The codes themselves come from the server. */
const INDICATOR_LABEL_KEYS = {
  WELCOME_QUALITY: 'surveys.indicators.welcomeQuality',
  SUPPORT_LEVEL: 'surveys.indicators.supportLevel',
  ROLE_CLARITY: 'surveys.indicators.roleClarity',
  MANAGER_RELATIONSHIP: 'surveys.indicators.managerRelationship',
  WORKING_CONDITIONS: 'surveys.indicators.workingConditions',
};

/** The aggregate satisfaction report — counts and averages only, never individual answers. */
export default function SurveysReportPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await surveysApi.satisfaction();
        setSummary(data);
      } catch {
        setError(t('surveys.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">{t('surveys.title')}</h1>
      <p className="mb-6 text-text-dim">{t('surveys.subtitle')}</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('surveys.stats.score')} value={summary.score === null ? '—' : `${summary.score}%`} />
        <StatTile
          label={t('surveys.stats.responseRate')}
          value={summary.responseRate === null ? '—' : `${summary.responseRate}%`}
        />
        <StatTile label={t('surveys.stats.roundsIssued')} value={summary.roundsIssued} />
        <StatTile label={t('surveys.stats.roundsOverdue')} value={summary.roundsOverdue} />
      </div>

      <div className="mb-6 overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
              <th className="px-4 py-2 font-medium">{t('surveys.columns.indicator')}</th>
              <th className="px-4 py-2 font-medium">{t('surveys.columns.average')}</th>
              <th className="px-4 py-2 font-medium">{t('surveys.stats.score')}</th>
              <th className="px-4 py-2 font-medium">{t('surveys.columns.responses')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.indicators.map((indicator) => (
              <tr key={indicator.indicator} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text">
                  {INDICATOR_LABEL_KEYS[indicator.indicator]
                    ? t(INDICATOR_LABEL_KEYS[indicator.indicator])
                    : indicator.indicator}
                </td>
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
            <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
              <th className="px-4 py-2 font-medium">{t('surveys.columns.milestone')}</th>
              <th className="px-4 py-2 font-medium">{t('surveys.stats.score')}</th>
              <th className="px-4 py-2 font-medium">{t('surveys.columns.responses')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.byMilestone.map((milestone) => (
              <tr key={milestone.dayOffset} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text">{t('surveys.dayOffset', { days: milestone.dayOffset })}</td>
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
