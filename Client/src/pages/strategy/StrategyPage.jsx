import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { strategyApi } from '../../api/strategy.js';
import { ApiError } from '../../api/client.js';

export default function StrategyPage() {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    strategyApi
      .get()
      .then((res) => setStrategy(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!strategy) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('strategy.unavailable')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('strategy.title')}</h1>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">{strategy.planFr}</h2>
        <p className="mt-2 text-[13.5px] text-text">{strategy.globalObjectiveFr}</p>
      </div>

      {strategy.markets.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('strategy.marketTargets')}
          </h3>
          <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
            <table className="w-full text-start text-[13px]">
              <thead className="bg-surface-2 text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('strategy.columns.market')}</th>
                  <th className="px-4 py-2 font-medium">{t('strategy.columns.strategy')}</th>
                  <th className="px-4 py-2 text-end font-medium">{t('strategy.columns.marketShareTarget')}</th>
                  <th className="px-4 py-2 text-end font-medium">{t('strategy.columns.revenueTarget')}</th>
                </tr>
              </thead>
              <tbody>
                {strategy.markets.map((market) => (
                  <tr key={market.id} className="border-t border-border">
                    <td className="px-4 py-2 text-text">{market.marketFr}</td>
                    <td className="px-4 py-2 text-text">{market.strategyFr}</td>
                    <td className="px-4 py-2 text-end font-mono text-text">{market.marketShareTargetFr}</td>
                    <td className="px-4 py-2 text-end font-mono text-text">{market.revenueTargetFr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {strategy.projects.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('strategy.projects')}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {strategy.projects.map((project) => (
              <div key={project.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <h4 className="font-display text-text">{project.code}</h4>
                <p className="mt-1 text-[13px] font-medium text-text">{project.titleFr}</p>
                <p className="mt-1 text-[13px] text-text">{project.descriptionFr}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {strategy.contributions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('strategy.contributions')}
          </h3>
          <div className="space-y-3">
            {strategy.contributions.map((contribution) => (
              <div key={contribution.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13.5px] font-medium text-text">{contribution.labelFr}</p>
                    <p className="text-[12px] text-text-muted">
                      {t('strategy.target', { value: contribution.targetFr })}
                    </p>
                  </div>
                  <span className="font-mono text-lg text-red-brand">{contribution.progressPercent}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-red-brand"
                    style={{ width: `${Math.min(100, Math.max(0, contribution.progressPercent))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
