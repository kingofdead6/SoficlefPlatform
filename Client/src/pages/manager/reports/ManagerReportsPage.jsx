import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { dashboardApi } from '../../../api/dashboard.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

function StatCard({ label, value, suffix = '' }) {
  const hasValue = value !== null && value !== undefined;
  return (
    <motion.div variants={staggerItem} initial="rest" whileHover="hover">
      <motion.div variants={cardHover} className="rounded-app border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-text-dim">{label}</p>
        <p className="mt-2 font-display text-3xl text-red-deep">
          {hasValue ? <CountUp value={value} suffix={suffix} /> : '—'}
        </p>
      </motion.div>
    </motion.div>
  );
}

/**
 * /app/manager/reports (route guide §2.2, SITE).
 * "KPIs scoped to his tree: average onboarding time, completion rate, satisfaction of his
 * recruits." Backed by GET /dashboard's `hr` block, which is already scoped per-caller by
 * scopeFilterFor(user, 'read', 'onboarding_instance') (application/dashboard/kpis.js) — a
 * MANAGER's ORGANIZATION_UNIT scope narrows this to their own tree automatically.
 * Stat values count up via anime.js on mount; the surrounding grid staggers in with
 * Framer Motion, which also owns card hover lift.
 */
export default function ManagerReportsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await dashboardApi.kpis();
        setData(data);
      } catch {
        setError(t('managerReports.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('managerReports.loading')} />;
  if (error) return <PageError message={error} />;

  const hr = data?.hr;
  const onboarding = data?.onboarding;

  return (
    <div>
      <PageHeader eyebrow={t('manager.eyebrow')} title={t('managerReports.title')} subtitle={t('managerReports.subtitle')} />

      {!hr && !onboarding && <EmptyState detail={t('managerReports.empty')} />}

      {onboarding && (
        <div className="mb-10">
          <h2 className="mb-3 font-display text-lg text-text">{t('managerReports.onboardingTitle')}</h2>
          <motion.div
            variants={staggerContainer(0.06)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <StatCard label={t('managerReports.metrics.activeJourneys')} value={onboarding.journeys} />
            <StatCard label={t('managerReports.metrics.averageProgress')} value={onboarding.averagePercent} suffix="%" />
            <StatCard label={t('managerReports.metrics.overdueTasks')} value={onboarding.overdueTasks} />
            <StatCard label={t('managerReports.metrics.blockedTasks')} value={onboarding.blockedTasks} />
          </motion.div>
        </div>
      )}

      {hr && (
        <div>
          <h2 className="mb-3 font-display text-lg text-text">{t('managerReports.hrTitle')}</h2>
          <motion.div
            variants={staggerContainer(0.06)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <StatCard label={t('managerReports.metrics.completion')} value={hr.completionRate} suffix="%" />
            <StatCard label={t('managerReports.metrics.duration')} value={hr.averageOnboardingDays} suffix={` ${t('managerReports.dayShort')}`} />
            <StatCard label={t('managerReports.metrics.confirmation')} value={hr.confirmationRate} suffix="%" />
            <StatCard label={t('managerReports.metrics.satisfaction')} value={hr.satisfaction} suffix="%" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
