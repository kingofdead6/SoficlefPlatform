import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { trainingApi } from '../../api/training.js';

/** The training catalogue with organisation-wide coverage — the /training nav entry. */
export default function TrainingPage() {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: catalogueData }, { data: coverageData }] = await Promise.all([
          trainingApi.catalogue(),
          trainingApi.coverage(),
        ]);
        setCatalogue(catalogueData);
        setCoverage(coverageData);
      } catch {
        setError(t('training.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">{t('training.title')}</h1>
      <p className="mb-6 text-text-dim">{t('training.subtitle')}</p>

      {coverage && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatTile label={t('training.coverage.people')} value={coverage.people} />
          <StatTile label={t('training.coverage.fullyTrained')} value={coverage.fullyTrained} />
          <StatTile label={t('training.coverage.rate')} value={coverage.rate === null ? '—' : `${coverage.rate}%`} />
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {catalogue.entries.map((entry) => (
          <li key={entry.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium text-text">{entry.titleFr}</h2>
              {entry.isMandatory && (
                <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">{t('training.mandatory')}</span>
              )}
            </div>
            <p className="mb-3 text-sm text-text-dim">{entry.summaryFr}</p>
            <Link to={`/app/me/training/${entry.code}`} className="text-sm font-medium text-red-brand hover:underline">
              {t('training.openModule')}
            </Link>
          </li>
        ))}
      </ul>
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
