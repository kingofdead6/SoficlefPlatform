import { useEffect, useState } from 'react';

import { qmsApi } from '../../api/qms.js';
import { ApiError } from '../../api/client.js';

const CATEGORY_LABELS_ORDER = ['MANAGEMENT', 'REALISATION', 'SUPPORT'];

export default function QmsPage() {
  const [qms, setQms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    qmsApi
      .get()
      .then((res) => setQms(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-text-dim">Chargement…</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!qms) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        Les informations SMQ ne sont pas encore disponibles.
      </div>
    );
  }

  const categoryLabels = {};
  for (const process of qms.processes) categoryLabels[process.category] ??= process.categoryLabelFr;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">SMQ · ISO 9001</h1>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">
          {qms.standardFr} · Certifié depuis {qms.certifiedSinceFr}
        </h2>
        <div className="mt-2 space-y-1 text-[13.5px] text-text">
          <p>Organisme certificateur : {qms.certificationBodyFr}</p>
          <p>Périmètre : {qms.certificationScopeFr}</p>
          <p>Cartographie des processus : {qms.processMapCode}</p>
        </div>
      </div>

      <div className="rounded-app border border-border bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">Processus piloté — {qms.ownedProcessCode}</h2>
        <p className="mt-2 text-[13.5px] text-text">{qms.ownedProcessNoteFr}</p>
      </div>

      {qms.responsibilities.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Responsabilités</h3>
          <ul className="list-disc space-y-2 ps-5">
            {qms.responsibilities.map((responsibility) => (
              <li key={responsibility.id} className="text-[13.5px] text-text">
                {responsibility.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {qms.processes.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            Cartographie des processus
          </h3>
          {CATEGORY_LABELS_ORDER.filter((category) => qms.processes.some((p) => p.category === category)).map(
            (category) => (
              <div key={category} className="mb-5">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">
                  {categoryLabels[category]}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {qms.processes
                    .filter((process) => process.category === category)
                    .map((process) => (
                      <div
                        key={process.id}
                        className="flex items-center justify-between gap-3 rounded-app border border-border bg-surface p-3 shadow-app"
                      >
                        <div>
                          <p className="font-mono text-[12.5px] text-text">{process.code}</p>
                          <p className="text-[13px] text-text">{process.nameFr}</p>
                        </div>
                        {process.isOwnedByProductionDirector && (
                          <span className="rounded-app bg-red-brand/10 px-2 py-1 text-[11px] text-red-brand">
                            Piloté par vous
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ),
          )}
        </section>
      )}
    </div>
  );
}
