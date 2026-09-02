import { useCallback, useEffect, useState } from 'react';

import { accountRequestsApi } from '../../api/account-requests.js';
import { ApiError } from '../../api/client.js';

const STATUS_LABELS = {
  OPEN: { labelFr: 'Ouverte', className: 'bg-red-brand/10 text-red-brand' },
  CREATED: { labelFr: 'Compte créé', className: 'bg-green-600/10 text-green-700' },
  REJECTED: { labelFr: 'Rejetée', className: 'bg-text-dim/10 text-text-dim' },
};

const URGENCY_LABELS = {
  NORMAL: 'Normale',
  URGENT: 'Urgente',
};

const EMPTY_FORM = {
  candidateNameFr: '',
  plannedPositionFr: '',
  plannedHireDate: '',
  urgency: 'NORMAL',
  noteFr: '',
};

/**
 * HR asking SI to create an account — the first hop of the provisioning chain
 * (CDC-2026 Module 1). Ported from app/actions/account-requests.ts and the
 * `listAccountRequests` read in application/organization/assignments.ts.
 */
export default function AccountRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await accountRequestsApi.list();
      setRequests(data ?? []);
    } catch {
      setError('Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await accountRequestsApi.create({
        candidateNameFr: form.candidateNameFr,
        plannedPositionFr: form.plannedPositionFr,
        plannedHireDate: form.plannedHireDate || null,
        urgency: form.urgency,
        noteFr: form.noteFr || undefined,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.body?.fieldErrors) {
        setFormError('Vérifiez les champs du formulaire.');
      } else {
        setFormError("La demande n'a pas pu être enregistrée.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-red-deep">Demandes de compte</h1>
        <p className="text-text-dim mt-1 text-sm">
          Demander à SI la création d'un compte pour un futur collaborateur. Les RH ne
          créent pas de compte elles-mêmes : ceci enregistre une demande que SI traite.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-app border border-border bg-surface p-4 space-y-4"
      >
        <h2 className="text-sm font-medium text-text">Nouvelle demande</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">Nom du candidat</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.candidateNameFr}
              onChange={(e) => setForm((f) => ({ ...f, candidateNameFr: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">Poste prévu</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.plannedPositionFr}
              onChange={(e) => setForm((f) => ({ ...f, plannedPositionFr: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">Date d'embauche prévue</span>
            <input
              type="date"
              value={form.plannedHireDate}
              onChange={(e) => setForm((f) => ({ ...f, plannedHireDate: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">Urgence</span>
            <select
              value={form.urgency}
              onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            >
              <option value="NORMAL">Normale</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-text-dim mb-1 block">Note (facultatif)</span>
          <textarea
            maxLength={1000}
            value={form.noteFr}
            onChange={(e) => setForm((f) => ({ ...f, noteFr: e.target.value }))}
            className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            rows={3}
          />
        </label>

        {formError && <p className="text-sm text-red-brand">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {submitting ? 'Envoi…' : 'Envoyer la demande'}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text">Demandes en cours</h2>
        {loading ? (
          <p className="text-text-dim text-sm">Chargement…</p>
        ) : error ? (
          <p className="text-sm text-red-brand">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-text-dim text-sm">Aucune demande.</p>
        ) : (
          <div className="overflow-x-auto rounded-app border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b text-left text-text-dim">
                  <th className="px-3 py-2 font-medium">Candidat</th>
                  <th className="px-3 py-2 font-medium">Poste</th>
                  <th className="px-3 py-2 font-medium">Urgence</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Attente</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-2 text-text">{request.candidateNameFr}</td>
                    <td className="px-3 py-2 text-text">{request.plannedPositionFr}</td>
                    <td className="px-3 py-2 text-text-dim">{URGENCY_LABELS[request.urgency] ?? request.urgency}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-app px-2 py-0.5 text-xs font-medium ${
                          STATUS_LABELS[request.status]?.className ?? 'bg-text-dim/10 text-text-dim'
                        }`}
                      >
                        {STATUS_LABELS[request.status]?.labelFr ?? request.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-dim">{request.waitingDays} j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
