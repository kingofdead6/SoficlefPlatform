import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { companyApi } from '../../api/company.js';
import { ApiError } from '../../api/client.js';

export default function CompanyPage() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    companyApi
      .get()
      .then((res) => setCompany(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!company) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('company.unavailable')}
      </div>
    );
  }

  const website = company.website.startsWith('http') ? company.website : `https://${company.website}`;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('company.title')}</h1>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">{company.legalName}</h2>
        <div className="mt-2 space-y-1 text-[13.5px] text-text">
          <p>
            {company.legalForm} ·{' '}
            {t('company.founded', { year: company.foundedYear, city: company.foundedCity })}
          </p>
          <p>{t('company.headquarters', { value: company.headquarters })}</p>
          <p>{t('company.generalManager', { value: company.generalManager })}</p>
          <p>
            {t('company.certification', { value: company.certification })} ·{' '}
            {t('company.status', { value: company.status })}
          </p>
          <p>
            <a href={website} target="_blank" rel="noreferrer" className="text-status-blue underline">
              {company.website}
            </a>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h3 className="font-display text-text">{t('company.vision')}</h3>
          <p className="mt-2 text-[13.5px] text-text">{company.visionFr}</p>
        </div>
        <div className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h3 className="font-display text-text">{t('company.mission')}</h3>
          <p className="mt-2 text-[13.5px] text-text">{company.missionFr}</p>
        </div>
      </div>

      {company.activities.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('company.activities')}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {company.activities.map((activity) => (
              <div key={activity.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <h4 className="font-display text-text">{activity.labelFr}</h4>
                <p className="mt-2 text-[13px] text-text">{activity.contentFr}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {company.values.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('company.values')}</h3>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {company.values.map((value) => (
              <li key={value.id} className="flex items-center gap-3 rounded-app border border-border bg-surface p-3 shadow-app">
                <span className="font-mono text-lg text-red-brand">{value.rank}</span>
                <span className="text-[13.5px] font-medium text-text">{value.nameFr}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
