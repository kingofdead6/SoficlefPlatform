import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { onboardingApi } from '../../api/onboarding.js';

/** Cross-perimeter checklist view: every journey the caller may see, with progress. */
export default function OnboardingChecklistPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.journeySummaries();
        setSummaries(data);
      } catch {
        setError('Impossible de charger les parcours.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Checklist onboarding</h1>
      <p className="mb-6 text-text-dim">Les parcours d'intégration visibles dans votre périmètre.</p>

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-2 font-medium">Collaborateur</th>
              <th className="px-4 py-2 font-medium">Modèle</th>
              <th className="px-4 py-2 font-medium">Début</th>
              <th className="px-4 py-2 font-medium">Progression</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.instanceId} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text">{summary.subjectName}</td>
                <td className="px-4 py-2 text-text-dim">{summary.templateTitleFr}</td>
                <td className="px-4 py-2 text-text-dim">{new Date(summary.startDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-2 text-text-dim">{summary.progress.percent}%</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to={`/app/me/journey?subjectUserId=${summary.subjectUserId}&instanceId=${summary.instanceId}`}
                    className="font-medium text-red-brand hover:underline"
                  >
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-dim">Aucun parcours.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
