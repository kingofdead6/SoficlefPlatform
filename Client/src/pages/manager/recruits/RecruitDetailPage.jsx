import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const EVAL_STATUS_LABELS = { DUE: 'À faire', DRAFT: 'Brouillon', SUBMITTED: 'Transmise' };
const MANAGER_TASK_STATUS_LABELS = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
  DONE: 'Terminée',
  VALIDATED: 'Validée',
};

export default function RecruitDetailPage() {
  const { userId } = useParams();
  const [recruit, setRecruit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  async function load() {
    setLoading(true);
    try {
      const { data } = await onboardingApi.managerRecruit(userId);
      setRecruit(data);
    } catch {
      setError('Recrue introuvable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  if (loading) return <PageLoading label="Chargement du dossier…" />;
  if (error && !recruit) return <PageError message={error} />;
  if (!recruit) return null;

  const instance = recruit.onboardingInstances?.[0];
  const position = recruit.assignments?.[0]?.position;

  return (
    <div>
      <Link to="/app/manager/recruits" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        ← Retour aux recrues
      </Link>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"
      >
        <div>
          <h1 className="mb-1 font-display text-3xl text-red-deep">{recruit.displayName}</h1>
          <p className="text-text-dim">
            {position?.titleFr ?? 'Poste non renseigné'} — {position?.organizationUnit?.nameFr ?? ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/manager/interviews/${userId}`}
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
          >
            Préparer un entretien
          </Link>
          <Link
            to={`/app/manager/recruits/${userId}/tasks/new`}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-red-light"
          >
            Assigner une tâche
          </Link>
        </div>
      </motion.div>

      <div className="space-y-6">
        {instance && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="rounded-app border border-border bg-surface p-5 shadow-app"
          >
            <h2 className="mb-3 font-display text-lg text-text">Évaluations</h2>
            <motion.ul variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2">
              {instance.evaluations.map((evaluation) => (
                <motion.li key={evaluation.id} variants={staggerItem} className="flex items-center justify-between text-sm">
                  <span className="text-text-dim">
                    {evaluation.milestone} — échéance {new Date(evaluation.dueDate).toLocaleDateString('fr-FR')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                      {EVAL_STATUS_LABELS[evaluation.status]}
                    </span>
                    {evaluation.status !== 'SUBMITTED' && (
                      <Link
                        to={`/app/manager/evaluations/${evaluation.id}`}
                        className="text-xs font-medium text-red-brand hover:underline"
                      >
                        Ouvrir
                      </Link>
                    )}
                  </div>
                </motion.li>
              ))}
            </motion.ul>
            {instance.evaluations.length === 0 && <EmptyState detail="Aucune évaluation." muted />}
          </motion.section>
        )}

        {instance && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.08 }}
            className="rounded-app border border-border bg-surface p-5 shadow-app"
          >
            <h2 className="mb-3 font-display text-lg text-text">Tâches manager</h2>
            <motion.ul variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible" className="mb-1 space-y-2">
              {instance.managerTasks.map((task) => (
                <motion.li key={task.id} variants={staggerItem} className="flex items-center justify-between text-sm">
                  <span className="text-text-dim">{task.titleFr}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                    {MANAGER_TASK_STATUS_LABELS[task.status]}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
            {instance.managerTasks.length === 0 && <EmptyState detail="Aucune tâche." muted />}
          </motion.section>
        )}

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.16 }}
          className="rounded-app border border-border bg-surface p-5 shadow-app"
        >
          <h2 className="mb-3 font-display text-lg text-text">Formation</h2>
          <motion.ul variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2 text-sm">
            {recruit.trainingAttempts.map((attempt, index) => (
              <motion.li key={index} variants={staggerItem} className="flex items-center justify-between">
                <span className="text-text-dim">{attempt.module.titleFr}</span>
                <span className={attempt.passed ? 'text-status-green' : 'text-status-red'}>
                  {attempt.score}% {attempt.passed ? '(réussi)' : ''}
                </span>
              </motion.li>
            ))}
          </motion.ul>
          {recruit.trainingAttempts.length === 0 && <EmptyState detail="Aucune tentative." muted />}
        </motion.section>
      </div>
    </div>
  );
}
