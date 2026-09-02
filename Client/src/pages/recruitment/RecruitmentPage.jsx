import { useEffect, useState } from 'react';

import { recruitmentApi } from '../../api/recruitment.js';
import { ApiError } from '../../api/client.js';

export default function RecruitmentPage() {
  const [recruitment, setRecruitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    recruitmentApi
      .get()
      .then((res) => setRecruitment(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-text-dim">Chargement…</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!recruitment) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        Aucun recrutement n'est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">Recrutements en cours</h1>

      {recruitment.positions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Postes ouverts</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recruitment.positions.map((position) => (
              <div key={position.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-display text-text">{position.titleFr}</h4>
                  <span className="rounded-app bg-red-brand/10 px-2 py-1 text-[11px] text-red-brand">
                    {position.statusFr}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-text">{position.attachmentFr}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-app border border-border bg-surface p-5 shadow-app">
        <h3 className="font-display text-text">Mobilité interne</h3>
        <p className="mt-2 text-[13.5px] text-text">{recruitment.internalMobilityNoteFr}</p>
      </div>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h3 className="font-display text-text">Action recommandée</h3>
        <p className="mt-2 text-[13.5px] text-text">{recruitment.recommendedActionFr}</p>
      </div>
    </div>
  );
}
