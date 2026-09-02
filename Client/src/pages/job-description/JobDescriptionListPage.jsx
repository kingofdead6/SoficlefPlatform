import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { jobDescriptionsApi } from '../../api/jobDescriptions.js';

const STATUS_LABELS = {
  DRAFT: 'Brouillon',
  IN_REVIEW: 'En revue',
  CHANGES_REQUESTED: 'Modifications demandées',
  VALIDATED: 'Validée',
  ARCHIVED: 'Archivée',
};

const STATUS_STYLES = {
  DRAFT: 'bg-surface-2 text-text-dim',
  IN_REVIEW: 'bg-status-blue/10 text-status-blue',
  CHANGES_REQUESTED: 'bg-status-amber/10 text-status-amber',
  VALIDATED: 'bg-status-green/10 text-status-green',
  ARCHIVED: 'bg-surface-2 text-text-dim',
};

export default function JobDescriptionListPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await jobDescriptionsApi.list();
        setDocuments(data);
      } catch {
        setError('Impossible de charger les fiches de poste.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">Chargement…</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">Fiches de poste</h1>
      <p className="mb-6 text-text-dim">Le référentiel des postes et leur statut de validation.</p>

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Intitulé</th>
              <th className="px-4 py-2 font-medium">Version</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.jobDescriptionId} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text-dim">{document.code}</td>
                <td className="px-4 py-2 text-text">{document.jobTitleFr}</td>
                <td className="px-4 py-2 text-text-dim">v{document.currentVersionNumber ?? '—'}</td>
                <td className="px-4 py-2">
                  {document.currentStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[document.currentStatus]}`}>
                      {STATUS_LABELS[document.currentStatus]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/job-description/${document.jobDescriptionId}`} className="font-medium text-red-brand hover:underline">
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-dim">Aucune fiche de poste.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
