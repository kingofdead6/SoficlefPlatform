import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { ApiError } from '../../../api/client.js';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CRITERIA = [
  { key: 'scoreSkills', label: 'Compétences techniques' },
  { key: 'scoreAutonomy', label: 'Autonomie' },
  { key: 'scoreIntegration', label: 'Intégration' },
  { key: 'scoreBehaviour', label: 'Comportement' },
];

export default function EvaluationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [evaluation, setEvaluation] = useState(null);
  const [form, setForm] = useState({
    scoreSkills: 3,
    scoreAutonomy: 3,
    scoreIntegration: 3,
    scoreBehaviour: 3,
    commentFr: '',
    recommendation: 'CONFIRM',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.evaluation(id);
        setEvaluation(data);
        setForm((prev) => ({
          ...prev,
          scoreSkills: data.scoreSkills ?? 3,
          scoreAutonomy: data.scoreAutonomy ?? 3,
          scoreIntegration: data.scoreIntegration ?? 3,
          scoreBehaviour: data.scoreBehaviour ?? 3,
          commentFr: data.commentFr ?? '',
          recommendation: data.recommendation ?? 'CONFIRM',
        }));
      } catch (err) {
        setError(err instanceof ApiError && err.status === 404 ? 'Évaluation introuvable.' : 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save(submitMode) {
    setSaving(true);
    setError(null);
    try {
      await onboardingApi.saveEvaluation({ evaluationId: id, ...form, submit: submitMode });
      navigate('/app/manager/evaluations');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? err.body?.message ?? 'Conflit.' : "L'enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading label="Chargement de l'évaluation…" />;
  if (error && !evaluation) return <PageError message={error} />;
  if (!evaluation) return null;

  const readOnly = evaluation.status === 'SUBMITTED';

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/manager/evaluations" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        ← Retour aux évaluations
      </Link>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 border-b border-border pb-6"
      >
        <h1 className="mb-1 font-display text-3xl text-red-deep">{evaluation.subject.displayName}</h1>
        <p className="text-text-dim">{evaluation.milestone} — échéance {new Date(evaluation.dueDate).toLocaleDateString('fr-FR')}</p>
      </motion.div>

      <AnimatePresence>
        {readOnly && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-app border border-status-green/30 bg-status-green/5 px-3 py-2 text-sm text-status-green"
          >
            Cette évaluation a déjà été transmise aux RH.
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="space-y-5 rounded-app border border-border bg-surface p-6 shadow-app"
      >
        {CRITERIA.map(({ key, label }) => (
          <motion.div key={key} variants={staggerItem}>
            <label className="mb-2 block text-sm text-text-muted">{label}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => {
                const active = form[key] === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setForm((prev) => ({ ...prev, [key]: value }))}
                    whileHover={readOnly || reduce ? undefined : { scale: 1.08 }}
                    whileTap={readOnly || reduce ? undefined : { scale: 0.92 }}
                    animate={active && !reduce ? { scale: [1, 1.15, 1] } : undefined}
                    transition={{ duration: 0.25 }}
                    className={`h-9 w-9 rounded-app border text-sm font-medium transition-colors disabled:opacity-50 ${
                      active ? 'border-red-brand bg-red-brand text-white' : 'border-border text-text-dim hover:border-red-brand'
                    }`}
                  >
                    {value}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}

        <motion.label variants={staggerItem} className="block text-sm text-text-muted">
          Commentaire
          <textarea
            disabled={readOnly}
            value={form.commentFr}
            onChange={(e) => setForm((prev) => ({ ...prev, commentFr: e.target.value }))}
            rows={4}
            className="mt-1 w-full rounded-app border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand disabled:opacity-50"
          />
        </motion.label>

        <motion.label variants={staggerItem} className="block text-sm text-text-muted">
          Recommandation
          <select
            disabled={readOnly}
            value={form.recommendation}
            onChange={(e) => setForm((prev) => ({ ...prev, recommendation: e.target.value }))}
            className="mt-1 w-full rounded-app border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand disabled:opacity-50"
          >
            <option value="CONFIRM">Confirmer</option>
            <option value="EXTEND">Prolonger la période d'essai</option>
            <option value="TERMINATE">Mettre fin</option>
          </select>
        </motion.label>

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

        {!readOnly && (
          <motion.div variants={staggerItem} className="flex gap-2">
            <motion.button
              type="button"
              disabled={saving}
              onClick={() => save('draft')}
              whileHover={reduce || saving ? undefined : { scale: 1.02 }}
              whileTap={reduce || saving ? undefined : { scale: 0.98 }}
              className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand disabled:opacity-60"
            >
              Enregistrer le brouillon
            </motion.button>
            <motion.button
              type="button"
              disabled={saving}
              onClick={() => save('submit')}
              whileHover={reduce || saving ? undefined : { scale: 1.02 }}
              whileTap={reduce || saving ? undefined : { scale: 0.98 }}
              className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
            >
              {saving ? 'Envoi…' : 'Transmettre aux RH'}
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
