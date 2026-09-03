import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

const SEVERITY_STYLES = {
  red: 'border-status-red/40 bg-status-red/5 text-status-red',
  blue: 'border-status-blue/40 bg-status-blue/5 text-status-blue',
};

export default function RecruitsPage() {
  const { t } = useTranslation();
  const [recruits, setRecruits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data, alerts: a } = await onboardingApi.managerRecruits();
        setRecruits(data);
        setAlerts(a ?? []);
      } catch {
        setError(t('managerRecruits.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('managerRecruits.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('managerRecruits.title')}
        subtitle={t('managerRecruits.subtitle')}
      />

      {alerts.length > 0 && (
        <motion.div
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="mb-6 space-y-2"
        >
          {alerts.map((alert) => (
            <motion.div key={alert.id} variants={staggerItem}>
              <Link
                to={alert.href}
                className={`block rounded-app border p-3 text-sm ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.blue}`}
              >
                <p className="font-medium">{alert.titleFr}</p>
                <p className="text-xs opacity-80">{alert.detailFr}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.ul
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="grid gap-4 sm:grid-cols-2"
      >
        {recruits.map((recruit) => (
          <motion.li
            key={recruit.instanceId}
            variants={staggerItem}
            whileHover={reduce ? undefined : 'hover'}
            initial="rest"
          >
            <motion.div
              variants={cardHover}
              className="rounded-app border border-border bg-surface p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-lg text-text">{recruit.displayName}</h2>
                <span className="text-xs text-text-muted">{t('manager.dayPlus', { count: recruit.dayNumber })}</span>
              </div>
              <p className="mb-3 text-sm text-text-dim">{recruit.positionFr ?? t('manager.noPosition')}</p>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full bg-red-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${recruit.percent}%` }}
                  transition={{ duration: reduce ? 0 : 0.8, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.15 }}
                />
              </div>
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-text-dim">
                <span>{t('managerRecruits.stepsRatio', { done: recruit.done, total: recruit.total })}</span>
                {recruit.overdue > 0 && (
                  <span className="text-status-red">{t('manager.overdueCount', { count: recruit.overdue })}</span>
                )}
                {recruit.blocked > 0 && (
                  <span className="text-status-red">{t('manager.blockedCount', { count: recruit.blocked })}</span>
                )}
                {recruit.evaluationsDue.length > 0 && (
                  <span className="text-status-amber">
                    {t('managerRecruits.evaluationsDueCount', { count: recruit.evaluationsDue.length })}
                  </span>
                )}
              </div>
              <Link
                to={`/app/manager/recruits/${recruit.userId}`}
                className="text-sm font-medium text-red-brand hover:underline"
              >
                {t('managerRecruits.viewRecord')} <span aria-hidden className="rtl:-scale-x-100">→</span>
              </Link>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>
      {recruits.length === 0 && (
        <EmptyState detail={t('managerRecruits.empty')} />
      )}
    </div>
  );
}
