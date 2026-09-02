import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { rowVariants, staggerContainer, initialOrNone } from '../../../lib/motion/variants.js';

/** Every evaluation due across the manager's recruits — derived from the recruits list. */
export default function EvaluationsPage() {
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
        setError('Impossible de charger les évaluations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading label="Chargement des évaluations…" />;
  if (error) return <PageError message={error} />;

  const rows = recruits.flatMap((recruit) =>
    recruit.evaluationsDue.map((evaluation) => ({ ...evaluation, recruit })),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Manager"
        title="Évaluations"
        subtitle="Points D+30, D+90 et fin de période d'essai à mener."
      />

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Collaborateur</th>
              <th className="px-4 py-3 font-medium">Étape</th>
              <th className="px-4 py-3 font-medium">Échéance</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
            {rows.map((row) => (
              <motion.tr key={row.id} variants={rowVariants} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-3 text-text">{row.recruit.displayName}</td>
                <td className="px-4 py-3 text-text-dim">{row.milestone}</td>
                <td className="px-4 py-3 text-text-dim">{new Date(row.dueDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/app/manager/evaluations/${row.id}`} className="font-medium text-red-brand hover:underline">
                    Évaluer
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-text-dim">Aucune évaluation en attente.</p>
        )}
      </div>
    </div>
  );
}
