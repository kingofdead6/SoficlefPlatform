import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { hseApi } from '../../api/hse.js';
import { ApiError } from '../../api/client.js';

export default function HsePage() {
  const { t } = useTranslation();
  const [hse, setHse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    hseApi
      .get()
      .then((res) => setHse(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!hse) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('hse.unavailable')}
      </div>
    );
  }

  const trafficRules = hse.rules.filter((rule) => rule.kind === 'TRAFFIC');
  const ppeRules = hse.rules.filter((rule) => rule.kind === 'PPE');

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">HSE</h1>

      <div className="rounded-app border border-status-red/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">{hse.siteFr}</h2>
        <p className="mt-1 text-[13.5px] text-text">{t('hse.contact', { value: hse.contactFr })}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h3 className="font-display text-text">{t('hse.zones')}</h3>
          <p className="mt-2 text-[13.5px] text-text">{hse.zonesFr}</p>
        </div>
        <div className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h3 className="font-display text-text">{t('hse.riskArea')}</h3>
          <p className="mt-2 text-[13.5px] text-text">{hse.riskAreaFr}</p>
        </div>
      </div>

      <div className="rounded-app border border-border bg-surface p-5 shadow-app">
        <h3 className="font-display text-text">{t('hse.circulationPlan')}</h3>
        <p className="mt-2 text-[13.5px] text-text">{hse.circulationPlanNoteFr}</p>
      </div>

      {trafficRules.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('hse.trafficRules')}
          </h3>
          <ul className="list-disc space-y-2 ps-5">
            {trafficRules.map((rule) => (
              <li key={rule.id} className="text-[13.5px] text-text">
                {rule.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ppeRules.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('hse.ppeRules')}
          </h3>
          <ul className="list-disc space-y-2 ps-5">
            {ppeRules.map((rule) => (
              <li key={rule.id} className="text-[13.5px] text-text">
                {rule.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
