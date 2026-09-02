import { useEffect, useState } from 'react';

import { competenciesApi } from '../../api/competencies.js';

/** The competency matrix / gap-analysis view for a chosen position. */
export default function CompetenciesPage() {
  const [positions, setPositions] = useState([]);
  const [positionId, setPositionId] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await competenciesApi.positions();
        setPositions(data);
        if (data.length > 0) setPositionId(data[0].positionId);
      } catch {
        setError('Impossible de charger les postes.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!positionId) return;
    (async () => {
      try {
        const { data } = await competenciesApi.matrix({ positionId });
        setMatrix(data);
      } catch {
        setMatrix(null);
      }
    })();
  }, [positionId]);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Compétences</h1>
      <p className="mb-6 text-text-dim">Matrice compétences par poste et analyse des écarts.</p>

      <label className="mb-6 block max-w-sm text-sm">
        <span className="mb-1 block text-text-muted">Poste</span>
        <select
          value={positionId ?? ''}
          onChange={(e) => setPositionId(e.target.value)}
          className="w-full rounded-app border border-border px-3 py-2 outline-none focus:border-red-brand"
        >
          {positions.map((position) => (
            <option key={position.positionId} value={position.positionId}>
              {position.positionTitleFr} ({position.competencyCount} compétences)
            </option>
          ))}
        </select>
      </label>

      {matrix && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Conformes" value={matrix.summary.conforme} />
            <StatTile label="À développer" value={matrix.summary.aDevelopper} />
            <StatTile label="Critiques" value={matrix.summary.critique} />
            <StatTile label="Taux de conformité" value={matrix.summary.conformityRate === null ? '—' : `${matrix.summary.conformityRate}%`} />
          </div>

          <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-2 font-medium">Compétence</th>
                  <th className="px-4 py-2 font-medium">Famille</th>
                  <th className="px-4 py-2 font-medium">Requis</th>
                  <th className="px-4 py-2 font-medium">Acquis</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.competencyId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-text">{row.nameFr}</td>
                    <td className="px-4 py-2 text-text-dim">{row.familyFr ?? '—'}</td>
                    <td className="px-4 py-2 text-text-dim">{row.requiredLevel} / {matrix.maxLevel}</td>
                    <td className="px-4 py-2 text-text-dim">{row.gap.actualLevel ?? '—'}</td>
                    <td className="px-4 py-2">
                      <GapBadge status={row.gap.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const GAP_LABELS = { conforme: 'Conforme', 'a-developper': 'À développer', critique: 'Critique', 'non-evalue': 'Non évalué' };
const GAP_STYLES = {
  conforme: 'bg-status-green/10 text-status-green',
  'a-developper': 'bg-status-amber/10 text-status-amber',
  critique: 'bg-status-red/10 text-status-red',
  'non-evalue': 'bg-surface-2 text-text-dim',
};

function GapBadge({ status }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GAP_STYLES[status]}`}>{GAP_LABELS[status]}</span>;
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-app border border-border bg-surface p-4 shadow-app">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
    </div>
  );
}
