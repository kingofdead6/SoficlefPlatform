import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { documentsApi } from '../../api/documents.js';
import { ApiError } from '../../api/client.js';
import { formatDate } from '../../lib/formatDate.js';

/**
 * The document library, with acknowledgement — merges SoficlefPlatform's
 * app/[locale]/(app)/documents/page.tsx (public library view) and
 * app/[locale]/(app)/app/me/documents/page.tsx (acknowledgement flow) into one page: each
 * document shows its status and, if not yet acknowledged, an "accepter" button.
 */
export default function DocumentsPage() {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    documentsApi
      .mine()
      .then((res) => setDocuments(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAcknowledge(id) {
    setBusyId(id);
    try {
      await documentsApi.acknowledge(id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('documents.acknowledgeFailed'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (documents.length === 0) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('documents.unavailable')}
      </div>
    );
  }

  const available = documents.filter((doc) => doc.availability === 'AVAILABLE');
  const pending = documents.filter((doc) => doc.availability === 'PENDING');

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('documents.title')}</h1>

      {available.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('documents.sections.available')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {available.map((doc) => (
              <div key={doc.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-display text-text">{doc.titleFr}</h4>
                  <span className="rounded-app bg-status-green/10 px-2 py-1 text-[11px] text-status-green">
                    {t('documents.badges.available')}
                  </span>
                </div>
                {doc.fileName && <p className="mt-1 font-mono text-[12px] text-text">{doc.fileName}</p>}
                {doc.detailFr && <p className="mt-1 text-[12.5px] text-text-muted">{doc.detailFr}</p>}
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12.5px] text-status-blue underline">
                    {t('documents.openFile')}
                  </a>
                )}

                <div className="mt-3">
                  {doc.acknowledgedAt ? (
                    <span className="text-[12px] text-status-green">
                      {t('documents.acknowledgedOn', { date: formatDate(doc.acknowledgedAt, i18n) })}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(doc.id)}
                      disabled={busyId === doc.id}
                      className="rounded-app bg-red-brand px-3 py-1.5 text-[12.5px] text-white disabled:opacity-50"
                    >
                      {busyId === doc.id ? t('common.states.sending') : t('documents.acknowledgeAction')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('documents.sections.pending')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pending.map((doc) => (
              <div key={doc.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-display text-text">{doc.titleFr}</h4>
                  <span className="rounded-app bg-surface-2 px-2 py-1 text-[11px] text-text-dim">{t('documents.badges.pending')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
