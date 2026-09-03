import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { jobDescriptionsApi } from '../../../api/jobDescriptions.js';
import { positionsApi } from '../../../api/organization.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

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

/**
 * /app/manager/job-descriptions — additional manager page (not in the PDF route guide;
 * added on request). GET /job-descriptions returns every job description the caller may
 * read, which for MANAGER (job_description:read, GLOBAL) is the whole company — filtered
 * here to the positions held by the manager's own tree (from GET /positions/tree, the same
 * source ManagerOrganigramPage reads), so a manager sees their team's job descriptions
 * rather than every position in SOFICLEF.
 *
 * Read-only, same as the employee-side /app/me/position: publishing/versioning workflow
 * stays HR's job (/app/hr/documents and the job description validate flow), this page only
 * links into the existing dossier view (/job-description/:id, shared with the un-scoped
 * cross-portal page) for detail.
 */
export default function ManagerJobDescriptionsPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [teamPositionIds, setTeamPositionIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [docsRes, treeRes] = await Promise.all([jobDescriptionsApi.list(), positionsApi.tree()]);
        setDocuments(docsRes.data);
        setTeamPositionIds(new Set(treeRes.data.map((node) => node.id)));
      } catch {
        setError(t('manager.jobDescriptions.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const teamDocuments = useMemo(() => {
    if (!teamPositionIds) return [];
    return documents.filter((document) => document.position && teamPositionIds.has(document.position.id));
  }, [documents, teamPositionIds]);

  if (loading) return <PageLoading label={t('manager.jobDescriptions.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('manager.jobDescriptions.title')}
        subtitle={t('manager.jobDescriptions.subtitle')}
      />

      <div className={`overflow-hidden ${CARD}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
              <th className="px-4 py-3 font-medium">{t('jobDescription.columns.jobTitle')}</th>
              <th className="px-4 py-3 font-medium">{t('jobDescription.columns.code')}</th>
              <th className="px-4 py-3 font-medium">{t('jobDescription.columns.version')}</th>
              <th className="px-4 py-3 font-medium">{t('common.labels.status')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer(0.04)} initial={initialOrNone(reduce)} animate="visible">
            {teamDocuments.map((document) => (
              <motion.tr
                key={document.jobDescriptionId}
                variants={staggerItem}
                className="border-b border-border last:border-0 hover:bg-surface-2/60"
              >
                <td className="px-4 py-3 text-text">{document.jobTitleFr}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-dim">{document.code}</td>
                <td className="px-4 py-3 text-text-dim">
                  {document.currentVersionNumber ? `v${document.currentVersionNumber}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {document.currentStatus && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[document.currentStatus]}`}
                    >
                      {STATUS_LABEL_KEYS[document.currentStatus]
                        ? t(STATUS_LABEL_KEYS[document.currentStatus])
                        : document.currentStatus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <Link
                    to={`/job-description/${document.jobDescriptionId}`}
                    className="font-medium text-red-brand hover:underline"
                  >
                    {t('common.actions.open')}
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {teamDocuments.length === 0 && (
          <div className="p-6">
            <EmptyState detail={t('manager.jobDescriptions.empty')} muted />
          </div>
        )}
      </div>
    </div>
  );
}
