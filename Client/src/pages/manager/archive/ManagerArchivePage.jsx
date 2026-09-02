import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
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
        setError("Impossible de charger l'historique.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoading label="Chargement de l'historique…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader eyebrow="Manager" title="Archive" subtitle="Parcours d'intégration terminés que vous avez encadrés." />

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Collaborateur</th>
              <th className="px-4 py-3 font-medium">Poste</th>
              <th className="px-4 py-3 font-medium">Démarré le</th>
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
                <td className="px-4 py-3 text-text-dim">{new Date(recruit.startDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/app/manager/recruits/${recruit.userId}`} className="text-xs font-medium text-red-brand hover:underline">
                    Consulter
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {recruits.length === 0 && <EmptyState detail="Aucun parcours terminé pour le moment." />}
      </div>
    </div>
  );
}
