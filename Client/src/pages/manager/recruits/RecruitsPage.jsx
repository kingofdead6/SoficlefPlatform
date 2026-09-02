import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

const SEVERITY_STYLES = {
  red: 'border-status-red/40 bg-status-red/5 text-status-red',
  blue: 'border-status-blue/40 bg-status-blue/5 text-status-blue',
};

export default function RecruitsPage() {
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
        setError('Impossible de charger les nouvelles recrues.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading label="Chargement des recrues…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Manager"
        title="Nouvelles recrues"
        subtitle="Les collaborateurs en intégration dans votre périmètre."
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
                <span className="text-xs text-text-muted">J+{recruit.dayNumber}</span>
              </div>
              <p className="mb-3 text-sm text-text-dim">{recruit.positionFr ?? 'Poste non renseigné'}</p>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full bg-red-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${recruit.percent}%` }}
                  transition={{ duration: reduce ? 0 : 0.8, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.15 }}
                />
              </div>
              <div className="mb-3 flex flex-wrap gap-3 text-xs text-text-dim">
                <span>{recruit.done}/{recruit.total} étapes</span>
                {recruit.overdue > 0 && <span className="text-status-red">{recruit.overdue} en retard</span>}
                {recruit.blocked > 0 && <span className="text-status-red">{recruit.blocked} bloquée(s)</span>}
                {recruit.evaluationsDue.length > 0 && (
                  <span className="text-status-amber">{recruit.evaluationsDue.length} évaluation(s) à faire</span>
                )}
              </div>
              <Link
                to={`/app/manager/recruits/${recruit.userId}`}
                className="text-sm font-medium text-red-brand hover:underline"
              >
                Voir le dossier →
              </Link>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>
      {recruits.length === 0 && (
        <EmptyState detail="Aucune recrue dans votre périmètre." />
      )}
    </div>
  );
}
