import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

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
        setError('Impossible de charger les indicateurs.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading label="Chargement des indicateurs…" />;
  if (error) return <PageError message={error} />;

  const hr = data?.hr;
  const onboarding = data?.onboarding;

  return (
    <div>
      <PageHeader eyebrow="Manager" title="Rapports" subtitle="Indicateurs limités à votre périmètre." />

      {!hr && !onboarding && <EmptyState detail="Aucun indicateur disponible pour votre périmètre." />}

      {onboarding && (
        <div className="mb-10">
          <h2 className="mb-3 font-display text-lg text-text">Parcours en cours</h2>
          <motion.div
            variants={staggerContainer(0.06)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <StatCard label="Parcours actifs" value={onboarding.journeys} />
            <StatCard label="Progression moyenne" value={onboarding.averagePercent} suffix="%" />
            <StatCard label="Tâches en retard" value={onboarding.overdueTasks} />
            <StatCard label="Tâches bloquées" value={onboarding.blockedTasks} />
          </motion.div>
        </div>
      )}

      {hr && (
        <div>
          <h2 className="mb-3 font-display text-lg text-text">Indicateurs RH</h2>
          <motion.div
            variants={staggerContainer(0.06)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <StatCard label="Taux de complétion" value={hr.completionRate} suffix="%" />
            <StatCard label="Durée moyenne d'intégration" value={hr.averageOnboardingDays} suffix=" j" />
            <StatCard label="Taux de confirmation" value={hr.confirmationRate} suffix="%" />
            <StatCard label="Satisfaction" value={hr.satisfaction} suffix="%" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
