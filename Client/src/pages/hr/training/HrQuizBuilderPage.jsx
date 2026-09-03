import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { trainingApi } from '../../../api/training.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

const emptyQuestion = () => ({
  promptFr: '',
  options: OPTION_KEYS.map((id) => ({ id, labelFr: '' })),
  correctOption: 'a',
  explanationFr: '',
});

/**
 * /app/hr/training/[id]/quiz (route guide §2.3, SITE).
 * "Quiz builder: questions, pass threshold."
 *
 * Questions are really added: POST /training/:moduleId/questions writes one
 * `TrainingQuestion` per submission, with its options as JSON and its correct answer.
 *
 * A deliberate asymmetry to note: `correctOption` never leaves the server on a read — the
 * catalogue strips it via `toPublicQuestions` so a learner cannot read the answers out of the
 * network response. That means this builder can *add* a question and see its prompt and
 * options afterwards, but cannot show which option was marked correct, because HR's own read
 * goes through the same protected path. The page says so rather than displaying a wrong
 * answer key.
 *
 * The pass threshold lives on the module (`passingScore`) and is set at module creation;
 * there is no module-update endpoint, so it is shown here read-only rather than offered as
 * an editable field that would silently fail.
 */
export default function HrQuizBuilderPage() {
  const { id: code } = useParams();
  const { user } = useAuth();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(emptyQuestion);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null);
  const reduce = useReducedMotion();

  const canEdit = can(user, 'update', 'training');

  const load = useCallback(async () => {
    try {
      const { data } = await trainingApi.module(code);
      setModule(data);
      setError(null);
    } catch {
      setError('Module de formation introuvable.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event) {
    event.preventDefault();
    const filled = draft.options.filter((option) => option.labelFr.trim() !== '');
    if (filled.length < 2) {
      setFormError('Une question doit proposer au moins deux réponses.');
      return;
    }
    if (!filled.some((option) => option.id === draft.correctOption)) {
      setFormError('La bonne réponse doit correspondre à une option renseignée.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await trainingApi.addQuestion(module.id, {
        moduleId: module.id,
        order: (module.questions?.length ?? 0) + 1,
        promptFr: draft.promptFr,
        options: filled,
        correctOption: draft.correctOption,
        explanationFr: draft.explanationFr || '',
      });
      setDraft(emptyQuestion());
      setNotice('Question ajoutée au quiz.');
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? 'L’ajout de la question a échoué.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement du quiz…" />;
  if (error) return <PageError message={error} />;
  if (!module) return null;

  const questions = module.questions ?? [];

  return (
    <div>
      <Link to="/app/hr/training" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        <span aria-hidden className="rtl:-scale-x-100">←</span> Retour au catalogue
      </Link>

      <PageHeader
        eyebrow="Ressources humaines"
        title={`Quiz — ${module.titleFr}`}
        subtitle={`${questions.length} question(s) — seuil de réussite ${module.passingScore}%.`}
      />

      {!canEdit && (
        <div className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          Votre rôle donne un accès en lecture au quiz. L’ajout de questions relève de
          l’administration (permission <code>training:update</code>).
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-4 font-display text-lg text-text">Questions du quiz</h2>
          {questions.length === 0 ? (
            <EmptyState
              title="Quiz vide"
              detail="Ce module ne comporte aucune question ; il ne peut donc pas encore être validé par un collaborateur."
              muted
            />
          ) : (
            <motion.div
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="space-y-3"
            >
              {questions.map((question, index) => (
                <motion.div key={question.id} variants={staggerItem} className={`${CARD} p-5`}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-red-brand">Q{index + 1}</span>
                    <p className="flex-1 font-medium text-text">{question.promptFr}</p>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {(question.options ?? []).map((option) => (
                      <li key={option.id} className="flex items-baseline gap-2 text-sm text-text-dim">
                        <span className="font-mono text-xs uppercase text-text-dim">{option.id}.</span>
                        <span>{option.labelFr}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          )}

          <p className="mt-4 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
            La bonne réponse n’est jamais renvoyée par l’API, y compris ici : le serveur retire
            <code> correctOption</code> de toute lecture du quiz, pour qu’un apprenant ne puisse pas
            la trouver dans la réponse réseau. Elle est enregistrée à la création de la question et
            n’est comparée qu’au moment de la correction, côté serveur.
          </p>
        </section>

        {canEdit && (
          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`${CARD} h-fit space-y-4 p-6 lg:col-span-2`}
          >
            <h2 className="font-display text-lg text-text">Ajouter une question</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-text">Énoncé</label>
              <textarea
                required
                rows={3}
                value={draft.promptFr}
                onChange={(e) => setDraft((d) => ({ ...d, promptFr: e.target.value }))}
                className={fieldClass}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-text">
                Réponses proposées (au moins deux)
              </legend>
              {draft.options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={draft.correctOption === option.id}
                    onChange={() => setDraft((d) => ({ ...d, correctOption: option.id }))}
                    aria-label={`Marquer la réponse ${option.id.toUpperCase()} comme correcte`}
                    className="accent-[var(--color-red-brand)]"
                  />
                  <span className="w-4 font-mono text-xs uppercase text-text-dim">{option.id}</span>
                  <input
                    value={option.labelFr}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        options: d.options.map((o, i) =>
                          i === index ? { ...o, labelFr: e.target.value } : o,
                        ),
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
              ))}
              <p className="text-xs text-text-dim">
                Le bouton radio marque la bonne réponse. Laissez une ligne vide pour proposer moins
                de quatre réponses.
              </p>
            </fieldset>

            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Explication (facultatif)
              </label>
              <textarea
                rows={2}
                value={draft.explanationFr}
                onChange={(e) => setDraft((d) => ({ ...d, explanationFr: e.target.value }))}
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
              {notice && !formError && (
                <motion.p
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-status-green"
                >
                  {notice}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
            >
              {submitting ? 'Ajout…' : 'Ajouter la question'}
            </button>

            <div className="border-t border-border pt-4 text-xs text-text-dim">
              <p className="mb-1 font-medium text-text-muted">
                Seuil de réussite : {module.passingScore}%
              </p>
              Le seuil est fixé à la création du module. La plateforme n’expose pas d’endpoint de
              modification d’un module existant, il n’est donc pas éditable ici.
            </div>
          </motion.form>
        )}
      </div>
    </div>
  );
}
