import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

/**
 * /app/manager/assistant (route guide §2.2, CORE).
 * "Agent 4: reminders, 'what's blocking X?', drafting feedback, procedure lookups."
 *
 * No LLM provider is wired into this platform anywhere (ADR-003) — there is no
 * generation step for drafting feedback or free-text procedure lookup. What *is* real:
 * reminders and "what's blocking X" are structured facts already computed by
 * domain/manager/alerts.js (alertsFor) from the manager's own recruits, so this page
 * surfaces those honestly instead of simulating a chat the platform can't back. The two
 * not-available sections are styled as calm, dashed-border empty states rather than
 * disabled-looking controls, so they read as an intentional product boundary.
 */
export default function ManagerAssistantPage() {
  const [recruits, setRecruits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data, alerts } = await onboardingApi.managerRecruits(false);
        setRecruits(data);
        setAlerts(alerts);
      } catch {
        setError("Impossible de charger l'assistant.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading label="Chargement de l'assistant…" />;
  if (error) return <PageError message={error} />;

  const reminders = alerts.filter((a) => a.kind === 'evaluation');
  const blockers = alerts.filter((a) => a.kind === 'blocked' || a.kind === 'overdue');

  return (
    <div>
      <PageHeader
        eyebrow="Manager"
        title="Assistant manager"
        subtitle="Aucun fournisseur de modèle de langage n'est raccordé à la plateforme (décision d'architecture). La rédaction de feedback et la recherche libre de procédures ne sont donc pas disponibles ici. Les rappels et les blocages, en revanche, sont des faits réels calculés depuis vos recrues."
      />

      <div className="space-y-8">
        <motion.section variants={sectionVariants} initial={initialOrNone(reduce)} animate="visible">
          <h2 className="mb-3 font-display text-lg text-text">Rappels — entretiens à venir</h2>
          <motion.div variants={staggerContainer(0.06)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2">
            {reminders.map((alert) => (
              <motion.div key={alert.id} variants={staggerItem}>
                <Link
                  to={alert.href}
                  className="block rounded-app border border-border bg-surface p-3 text-sm shadow-app transition hover:border-red-brand hover:shadow-app-lifted"
                >
                  <p className="font-medium text-text">{alert.titleFr}</p>
                  <p className="text-xs text-text-dim">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          {reminders.length === 0 && <EmptyState detail="Aucun rappel." muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.08 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">Qu'est-ce qui bloque ?</h2>
          <motion.div variants={staggerContainer(0.06)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2">
            {blockers.map((alert) => (
              <motion.div key={alert.id} variants={staggerItem}>
                <Link
                  to={alert.href}
                  className="block rounded-app border border-status-red/40 bg-status-red/10 p-3 text-sm text-status-red shadow-app transition hover:shadow-app-lifted"
                >
                  <p className="font-medium">{alert.titleFr}</p>
                  <p className="text-xs opacity-80">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          {blockers.length === 0 && <EmptyState detail="Aucun blocage détecté." muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.16 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">Rédiger un feedback</h2>
          <EmptyState
            title="Non disponible"
            detail="La rédaction assistée dépend d'un fournisseur de modèle de langage, qui n'est pas raccordé. Utilisez la fiche d'entretien pour préparer vos points manuellement."
            muted
          />
          {recruits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recruits.map((recruit) => (
                <Link
                  key={recruit.userId}
                  to={`/app/manager/interviews/${recruit.userId}`}
                  className="rounded-app border border-border px-2 py-1 text-xs font-medium text-red-brand transition hover:bg-surface-2"
                >
                  {recruit.displayName}
                </Link>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.24 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">Recherche de procédures</h2>
          <EmptyState title="Non disponible" detail="Non disponible ici pour la même raison. Consultez la bibliothèque documentaire directement." muted />
        </motion.section>
      </div>
    </div>
  );
}
