import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { accountRequestsApi } from '../../../api/account-requests.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, rowVariants, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const STATUS_LABELS = {
  OPEN: { labelFr: 'Ouverte', className: 'bg-red-brand/10 text-red-brand' },
  CREATED: { labelFr: 'Compte créé', className: 'bg-status-green/10 text-status-green' },
  REJECTED: { labelFr: 'Rejetée', className: 'bg-surface-2 text-text-dim' },
};

const URGENCY_LABELS = { NORMAL: 'Normale', URGENT: 'Urgente' };

const EMPTY_FORM = {
  candidateNameFr: '',
  plannedPositionFr: '',
  plannedHireDate: '',
  urgency: 'NORMAL',
  noteFr: '',
};

/**
 * /app/hr/employees/request (route guide §2.3, CORE).
 * "Request account → opens an SI ticket (candidate name, planned position, planned hire
 * date, urgency)."
 *
 * HR deliberately holds no `user:create`: this records a request that SI acts on, which is
 * exactly what POST /account-requests does. The list below is the same request log, so HR
 * can see what is still open rather than re-sending a ticket that already exists.
 */
export default function HrRequestAccountPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await accountRequestsApi.list();
      setRequests(data ?? []);
      setError(null);
    } catch {
      setError('Impossible de charger les demandes de compte.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setConfirmation(null);
    try {
      await accountRequestsApi.create({
        candidateNameFr: form.candidateNameFr,
        plannedPositionFr: form.plannedPositionFr,
        plannedHireDate: form.plannedHireDate || null,
        urgency: form.urgency,
        noteFr: form.noteFr || undefined,
      });
      setConfirmation(`Demande envoyée au SI pour ${form.candidateNameFr}.`);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.body?.fieldErrors
          ? 'Vérifiez les champs du formulaire.'
          : 'La demande n’a pas pu être enregistrée.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement des demandes…" />;
  if (error && requests.length === 0) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Demander un compte"
        subtitle="Les RH ne créent pas de compte : cette demande ouvre un ticket que le SI traite, puis le compte revient ici pour affectation."
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <motion.form
          onSubmit={handleSubmit}
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          className={`${CARD} space-y-4 p-6 lg:col-span-2`}
        >
          <h2 className="font-display text-lg text-text">Nouvelle demande</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Nom du candidat</label>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.candidateNameFr}
              onChange={(e) => setForm((f) => ({ ...f, candidateNameFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Poste prévu</label>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.plannedPositionFr}
              onChange={(e) => setForm((f) => ({ ...f, plannedPositionFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Embauche prévue</label>
              <input
                type="date"
                value={form.plannedHireDate}
                onChange={(e) => setForm((f) => ({ ...f, plannedHireDate: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Urgence</label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className={fieldClass}
              >
                <option value="NORMAL">Normale</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Note (facultatif)</label>
            <textarea
              maxLength={1000}
              rows={3}
              value={form.noteFr}
              onChange={(e) => setForm((f) => ({ ...f, noteFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <AnimatePresence>
            {formError && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-status-red"
              >
                {formError}
              </motion.p>
            )}
            {confirmation && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-status-green"
              >
                {confirmation}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={reduce || submitting ? undefined : { scale: 1.02 }}
            whileTap={reduce || submitting ? undefined : { scale: 0.98 }}
            className="w-full rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
          >
            {submitting ? 'Envoi…' : 'Envoyer la demande au SI'}
          </motion.button>
        </motion.form>

        <section className="lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-text">Demandes enregistrées</h2>
            <span className="text-sm text-text-dim">{requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <EmptyState detail="Aucune demande de compte enregistrée." muted />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                    <th className="px-4 py-3 font-medium">Candidat</th>
                    <th className="px-4 py-3 font-medium">Poste prévu</th>
                    <th className="px-4 py-3 font-medium">Urgence</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Attente</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer(0.04, 0.2)}
                  initial={initialOrNone(reduce)}
                  animate="visible"
                >
                  {requests.map((request) => (
                    <motion.tr
                      key={request.id}
                      variants={rowVariants}
                      className="border-b border-border last:border-0 hover:bg-surface-2/60"
                    >
                      <td className="px-4 py-3 font-medium text-text">{request.candidateNameFr}</td>
                      <td className="px-4 py-3 text-text-dim">{request.plannedPositionFr}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {URGENCY_LABELS[request.urgency] ?? request.urgency}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_LABELS[request.status]?.className ?? 'bg-surface-2 text-text-dim'
                          }`}
                        >
                          {STATUS_LABELS[request.status]?.labelFr ?? request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-dim">{request.waitingDays} j</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
