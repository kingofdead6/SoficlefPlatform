import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import { localeOf } from '../../../lib/formatDate.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { rowVariants, staggerContainer, initialOrNone } from '../../../lib/motion/variants.js';

/** Every evaluation due across the manager's recruits — derived from the recruits list. */
export default function EvaluationsPage() {
  const { t, i18n } = useTranslation();
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerRecruits(true);
        setRecruits(data);
      } catch {
        setError(t('manager.evaluations.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('manager.evaluations.loading')} />;
  if (error) return <PageError message={error} />;

  const rows = recruits.flatMap((recruit) =>
    recruit.evaluationsDue.map((evaluation) => ({ ...evaluation, recruit })),
  );

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('manager.evaluations.title')}
        subtitle={t('manager.evaluations.subtitle')}
      />

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
              <th className="px-4 py-3 font-medium">{t('common.labels.employee')}</th>
              <th className="px-4 py-3 font-medium">{t('manager.evaluations.milestoneColumn')}</th>
              <th className="px-4 py-3 font-medium">{t('common.labels.dueDate')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
            {rows.map((row) => (
              <motion.tr key={row.id} variants={rowVariants} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-3 text-text">{row.recruit.displayName}</td>
                <td className="px-4 py-3 text-text-dim">{row.milestone}</td>
                <td className="px-4 py-3 text-text-dim">{new Date(row.dueDate).toLocaleDateString(localeOf(i18n))}</td>
                <td className="px-4 py-3 text-end">
                  <Link to={`/app/manager/evaluations/${row.id}`} className="font-medium text-red-brand hover:underline">
                    {t('manager.evaluations.evaluateAction')}
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-text-dim">{t('manager.evaluations.empty')}</p>
        )}
      </div>
    </div>
  );
}
