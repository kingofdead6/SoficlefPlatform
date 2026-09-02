import { useEffect, useState } from 'react';

import { onboardingApi } from '../../api/onboarding.js';
import { useAuth } from '../../auth/AuthContext.jsx';

/** The new arrival's welcome / overview page — greeting, progress, next steps, contacts. */
export default function WelcomePage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.meOverview();
        setOverview(data);
      } catch {
        setError('Impossible de charger votre espace de bienvenue.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;
  if (!overview) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Bienvenue, {user?.displayName}</h1>
      <p className="mb-6 text-text-dim">
        {overview.dayNumber === null
          ? "Votre parcours d'intégration n'a pas encore commencé."
          : `Jour ${overview.dayNumber} de votre intégration.`}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-app border border-border bg-surface p-4 shadow-app">
          <h2 className="mb-2 font-medium text-text">Ma progression</h2>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-red-brand" style={{ width: `${overview.progress.percent}%` }} />
          </div>
          <p className="text-sm text-text-dim">{overview.progress.done}/{overview.progress.total} étapes terminées</p>
        </div>

        <div className="rounded-app border border-border bg-surface p-4 shadow-app">
          <h2 className="mb-2 font-medium text-text">Contacts</h2>
          {overview.manager && (
            <p className="text-sm text-text-dim">Manager : {overview.manager.displayName} ({overview.manager.email})</p>
          )}
          {overview.hrContact && (
            <p className="text-sm text-text-dim">RH : {overview.hrContact.nameFr} — poste {overview.hrContact.extension}</p>
          )}
        </div>
      </div>

      <div className="rounded-app border border-border bg-surface p-4 shadow-app">
        <h2 className="mb-3 font-medium text-text">Prochaines étapes</h2>
        <ul className="space-y-2 text-sm">
          {overview.nextTasks.map((task) => (
            <li key={task.milestoneId} className="text-text-dim">
              {task.titleFr}
              {task.dueDate && ` — échéance ${new Date(task.dueDate).toLocaleDateString('fr-FR')}`}
            </li>
          ))}
          {overview.nextTasks.length === 0 && <p className="text-text-dim">Aucune étape en attente.</p>}
        </ul>
      </div>
    </div>
  );
}
