import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { jobDescriptionsApi } from '../../api/jobDescriptions.js';

/** API statuses → catalogue keys. The status values themselves come from the server. */
const STATUS_LABEL_KEYS = {
  DRAFT: 'jobDescription.status.draft',
  IN_REVIEW: 'jobDescription.status.inReview',
  CHANGES_REQUESTED: 'jobDescription.status.changesRequested',
  VALIDATED: 'jobDescription.status.validated',
  ARCHIVED: 'jobDescription.status.archived',
};

const STATUS_STYLES = {
  DRAFT: 'bg-surface-2 text-text-dim',
  IN_REVIEW: 'bg-status-blue/10 text-status-blue',
  CHANGES_REQUESTED: 'bg-status-amber/10 text-status-amber',
  VALIDATED: 'bg-status-green/10 text-status-green',
  ARCHIVED: 'bg-surface-2 text-text-dim',
};

export default function JobDescriptionListPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await jobDescriptionsApi.list();
        setDocuments(data);
      } catch {
        setError(t('jobDescription.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">{t('jobDescription.listTitle')}</h1>
      <p className="mb-6 text-text-dim">{t('jobDescription.listSubtitle')}</p>

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-2 font-medium">{t('jobDescription.columns.code')}</th>
              <th className="px-4 py-2 font-medium">{t('jobDescription.columns.jobTitle')}</th>
              <th className="px-4 py-2 font-medium">{t('jobDescription.columns.version')}</th>
              <th className="px-4 py-2 font-medium">{t('common.labels.status')}</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.jobDescriptionId} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text-dim">{document.code}</td>
                <td className="px-4 py-2 text-text">{document.jobTitleFr}</td>
                <td className="px-4 py-2 text-text-dim">v{document.currentVersionNumber ?? '—'}</td>
                <td className="px-4 py-2">
                  {document.currentStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[document.currentStatus]}`}>
                      {STATUS_LABEL_KEYS[document.currentStatus]
                        ? t(STATUS_LABEL_KEYS[document.currentStatus])
                        : document.currentStatus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/job-description/${document.jobDescriptionId}`} className="font-medium text-red-brand hover:underline">
                    {t('common.actions.open')}
                  </Link>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-dim">
                  {t('jobDescription.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
