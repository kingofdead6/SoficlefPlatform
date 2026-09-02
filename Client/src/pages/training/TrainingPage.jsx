import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { trainingApi } from '../../api/training.js';

/** The training catalogue with organisation-wide coverage — the /training nav entry. */
export default function TrainingPage() {
  const [catalogue, setCatalogue] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: catalogueData }, { data: coverageData }] = await Promise.all([
          trainingApi.catalogue(),
          trainingApi.coverage(),
        ]);
        setCatalogue(catalogueData);
        setCoverage(coverageData);
      } catch {
        setError('Impossible de charger la formation.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Formation</h1>
      <p className="mb-6 text-text-dim">Catalogue des modules et couverture de la formation obligatoire.</p>

      {coverage && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatTile label="Personnes" value={coverage.people} />
          <StatTile label="Formation complète" value={coverage.fullyTrained} />
          <StatTile label="Taux" value={coverage.rate === null ? '—' : `${coverage.rate}%`} />
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {catalogue.entries.map((entry) => (
          <li key={entry.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium text-text">{entry.titleFr}</h2>
              {entry.isMandatory && (
                <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">Obligatoire</span>
              )}
            </div>
            <p className="mb-3 text-sm text-text-dim">{entry.summaryFr}</p>
            <Link to={`/app/me/training/${entry.code}`} className="text-sm font-medium text-red-brand hover:underline">
              Ouvrir le module →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-app border border-border bg-surface p-4 shadow-app">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </div>
  );
}
