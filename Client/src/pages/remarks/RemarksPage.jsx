import { useEffect, useState } from 'react';

import { remarksApi } from '../../api/remarks.js';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can, hasRole } from '../../lib/permissions.js';

/**
 * The remarks journal (CDC v1 §3.7) — ported from the source app's SELF-scoped
 * add/delete actions plus the HR/ADMIN export route. An EMPLOYEE sees and manages only
 * their own remarks (server enforces this via scopeFilterFor); HR/ADMIN see everyone's
 * and get an export button.
 */
export default function RemarksPage() {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Only HR/ADMIN see everyone's remarks (server-enforced via scopeFilterFor); the export
  // button is only useful to them.
  const mayExport = hasRole(user, 'HR') || hasRole(user, 'ADMIN');

  function load() {
    setLoading(true);
    remarksApi
      .list()
      .then((res) => setRemarks(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await remarksApi.create(content.trim());
      setContent('');
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Échec de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette remarque ?')) return;
    try {
      await remarksApi.remove(id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Échec de la suppression.');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-red-deep">Remarques</h1>
        {mayExport && (
          <a
            href={remarksApi.exportUrl()}
            className="rounded-app border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-dim hover:text-text"
          >
            Exporter (.txt)
          </a>
        )}
      </div>

      {can(user, 'create', 'remark') && (
        <form onSubmit={handleSubmit} className="rounded-app border border-border bg-surface p-4 shadow-app">
          <label className="mb-2 block text-[12.5px] font-medium text-text-dim">
            Adresser une observation aux RH / à la direction
          </label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            maxLength={5000}
            className="w-full rounded-app border border-border bg-surface p-3 text-[13px] text-text"
            placeholder="Votre remarque…"
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="mt-2 rounded-app bg-red-brand px-4 py-1.5 text-[13px] text-white disabled:opacity-50"
          >
            {submitting ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-text-dim">Chargement…</div>
      ) : error ? (
        <div className="text-status-red">{error}</div>
      ) : remarks.length === 0 ? (
        <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
          Aucune remarque enregistrée.
        </div>
      ) : (
        <ul className="space-y-3">
          {remarks.map((remark) => (
            <li key={remark.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-text-dim">
                    {remark.author?.displayName} · {new Date(remark.createdAt).toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-text">{remark.contentFr}</p>
                </div>
                {remark.authorId === user?.id && (
                  <button
                    onClick={() => handleDelete(remark.id)}
                    className="shrink-0 text-[12px] text-status-red hover:underline"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
