import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';

const DEPARTMENTS = ['HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE'];

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/manager/recruits/[id]/tasks/new (route guide §2.2, SITE).
 * Ad-hoc task: title, description, due date, owner, attachment.
 * (File attachment is not modelled on ManagerTask in the source schema — omitted rather
 * than faked; the task itself still records title/description/due date/owner.)
 */
export default function AssignTaskPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [recruit, setRecruit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ titleFr: '', detailFr: '', dueDate: '', ownerDepartment: 'MANAGER' });
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerRecruit(userId);
        setRecruit(data);
      } catch {
        setError('Recrue introuvable.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const instanceId = recruit?.onboardingInstances?.[0]?.id;
    if (!instanceId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onboardingApi.createManagerTask({ ...form, instanceId, dueDate: form.dueDate || null });
      navigate(`/app/manager/recruits/${userId}`);
    } catch {
      setError("La création de la tâche a échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement…" />;
  if (error && !recruit) return <PageError message={error} />;
  if (!recruit) return null;

  return (
    <div className="mx-auto max-w-xl">
      <Link to={`/app/manager/recruits/${userId}`} className="mb-4 inline-block text-sm text-red-brand hover:underline">
        ← Retour à {recruit.displayName}
      </Link>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 border-b border-border pb-6"
      >
        <h1 className="mb-1 font-display text-3xl text-red-deep">Assigner une tâche</h1>
        <p className="text-text-dim">Nouvelle tâche ad hoc pour {recruit.displayName}.</p>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: reduce ? 0 : 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4 rounded-app border border-border bg-surface p-6 shadow-app"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Titre</label>
          <input
            type="text"
            required
            value={form.titleFr}
            onChange={(e) => setForm((prev) => ({ ...prev, titleFr: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Description</label>
          <textarea
            value={form.detailFr}
            onChange={(e) => setForm((prev) => ({ ...prev, detailFr: e.target.value }))}
            rows={4}
            className={fieldClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Échéance</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Responsable</label>
            <select
              value={form.ownerDepartment}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerDepartment: e.target.value }))}
              className={fieldClass}
            >
              {DEPARTMENTS.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-status-red"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            to={`/app/manager/recruits/${userId}`}
            className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition hover:bg-surface-2"
          >
            Annuler
          </Link>
          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={reduce || submitting ? undefined : { scale: 1.03 }}
            whileTap={reduce || submitting ? undefined : { scale: 0.97 }}
            className="relative rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={submitting ? 'submitting' : 'idle'}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2"
              >
                {submitting && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {submitting ? 'Envoi…' : 'Assigner'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}
