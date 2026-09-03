import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { qmsApi } from '../../api/qms.js';
import { ApiError } from '../../api/client.js';

const CATEGORY_LABELS_ORDER = ['MANAGEMENT', 'REALISATION', 'SUPPORT'];

export default function QmsPage() {
  const { t } = useTranslation();
  const [qms, setQms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    qmsApi
      .get()
      .then((res) => setQms(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!qms) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('qms.unavailable')}
      </div>
    );
  }

  const categoryLabels = {};
  for (const process of qms.processes) categoryLabels[process.category] ??= process.categoryLabelFr;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('qms.title')}</h1>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">
          {qms.standardFr} · {t('qms.certifiedSince', { value: qms.certifiedSinceFr })}
        </h2>
        <div className="mt-2 space-y-1 text-[13.5px] text-text">
          <p>{t('qms.certificationBody', { value: qms.certificationBodyFr })}</p>
          <p>{t('qms.certificationScope', { value: qms.certificationScopeFr })}</p>
          <p>{t('qms.processMap', { value: qms.processMapCode })}</p>
        </div>
      </div>

      <div className="rounded-app border border-border bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">
          {t('qms.ownedProcess', { code: qms.ownedProcessCode })}
        </h2>
        <p className="mt-2 text-[13.5px] text-text">{qms.ownedProcessNoteFr}</p>
      </div>

      {qms.responsibilities.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('qms.responsibilities')}</h3>
          <ul className="list-disc space-y-2 ps-5">
            {qms.responsibilities.map((responsibility) => (
              <li key={responsibility.id} className="text-[13.5px] text-text">
                {responsibility.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {qms.processes.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('qms.processMapHeading')}
          </h3>
          {CATEGORY_LABELS_ORDER.filter((category) => qms.processes.some((p) => p.category === category)).map(
            (category) => (
              <div key={category} className="mb-5">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">
                  {categoryLabels[category]}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {qms.processes
                    .filter((process) => process.category === category)
                    .map((process) => (
                      <div
                        key={process.id}
                        className="flex items-center justify-between gap-3 rounded-app border border-border bg-surface p-3 shadow-app"
                      >
                        <div>
                          <p className="font-mono text-[12.5px] text-text">{process.code}</p>
                          <p className="text-[13px] text-text">{process.nameFr}</p>
                        </div>
                        {process.isOwnedByProductionDirector && (
                          <span className="rounded-app bg-red-brand/10 px-2 py-1 text-[11px] text-red-brand">
                            {t('qms.ownedByYou')}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ),
          )}
        </section>
      )}
    </div>
  );
}
