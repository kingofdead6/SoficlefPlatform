import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import { localeOf } from '../../../lib/formatDate.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

/**
 * /app/manager/archive — additional manager page (not in the PDF route guide; added on
 * request). Completed onboarding journeys the manager has overseen, for historical
 * reference. Backed by the same GET /onboarding/manager/recruits?includeArchived=true
 * RecruitsPage already uses, filtered here to `completed`.
 */
export default function ManagerArchivePage() {
  const { t, i18n } = useTranslation();
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerRecruits(true);
        setRecruits(data.filter((recruit) => recruit.completed));
      } catch {
        setError(t('manager.archive.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('manager.archive.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader eyebrow={t('manager.eyebrow')} title={t('manager.archive.title')} subtitle={t('manager.archive.subtitle')} />

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">{t('common.labels.employee')}</th>
              <th className="px-4 py-3 font-medium">{t('common.labels.position')}</th>
              <th className="px-4 py-3 font-medium">{t('manager.archive.startedOn')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
            {recruits.map((recruit) => (
              <motion.tr
                key={recruit.instanceId}
                variants={staggerItem}
                className="border-b border-border last:border-0 hover:bg-surface-2/60"
              >
                <td className="px-4 py-3 text-text">{recruit.displayName}</td>
                <td className="px-4 py-3 text-text-dim">{recruit.positionFr ?? '—'}</td>
                <td className="px-4 py-3 text-text-dim">{new Date(recruit.startDate).toLocaleDateString(localeOf(i18n))}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/app/manager/recruits/${recruit.userId}`} className="text-xs font-medium text-red-brand hover:underline">
                    {t('manager.archive.viewRecord')}
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {recruits.length === 0 && <EmptyState detail={t('manager.archive.empty')} />}
      </div>
    </div>
  );
}
