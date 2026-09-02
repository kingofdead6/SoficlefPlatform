import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { trainingApi } from '../../../api/training.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * /app/me/training/[moduleId] — Module player (route guide §2.1, CORE).
 * "Lesson content, quiz, score, retry, certificate on pass."
 *
 * Two steps, not one scroll: the lesson, then the quiz. That is not decoration — starting a
 * recruit on a page whose first visible element is a question they have not been taught the
 * answer to is the wrong order, and the step marker makes the sequence explicit.
 *
 * Grading is entirely server-side (POST /training/:moduleId/attempts): `correctOption` never
 * reaches the browser, so this page cannot pre-check an answer or reveal one, and the score
 * it renders is the one the server computed. `certifiedAt` is likewise set by the server, on
 * the first pass only — this page reports certification rather than deciding it.
 */
export default function TrainingModulePage() {
  const { code } = useParams();
  const [module, setModule] = useState(null);
  const [answers, setAnswers] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [step, setStep] = useState('lesson');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await trainingApi.module(code);
      setModule(data);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'Module introuvable.' : 'Impossible de charger ce module.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setOutcome(null);
    setAnswers({});
    setStep('lesson');
    setError(null);
    setFormError(null);
    load();
  }, [load]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!module) return;

    const unanswered = module.questions.filter((question) => !answers[question.id]);
    if (unanswered.length > 0) {
      setFormError(`Répondez à toutes les questions (${unanswered.length} restante(s)).`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await trainingApi.submitAttempt(module.id, answers);
      setOutcome(data);
      setStep('result');
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.body?.message ? err.body.message : "L'envoi du questionnaire a échoué.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setOutcome(null);
    setAnswers({});
    setFormError(null);
    setStep('quiz');
  }

  if (loading) return <PageLoading label="Chargement du module…" />;
  if (error) return <PageError message={error} />;
  if (!module) return null;

  const hasQuiz = module.questions.length > 0;
  const answered = module.questions.filter((question) => answers[question.id]).length;

  const STEPS = [
    { id: 'lesson', labelFr: 'Contenu' },
    { id: 'quiz', labelFr: 'Questionnaire' },
    { id: 'result', labelFr: 'Résultat' },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Ma formation"
        title={module.titleFr}
        subtitle={module.summaryFr}
        actions={
          <>
            <Link
              to="/app/me/training"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Tous les modules
            </Link>
            <Link
              to="/app/me/training/certificates"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Mes attestations
            </Link>
          </>
        }
      />

      {/* Step marker. */}
      <ol className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((entry, index) => {
          const active = step === entry.id;
          const reached = STEPS.findIndex((s) => s.id === step) >= index;
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-xs font-semibold',
                  active
                    ? 'bg-red-brand text-white'
                    : reached
                      ? 'bg-red-brand/15 text-red-deep'
                      : 'bg-surface-2 text-text-dim',
                )}
              >
                {index + 1}
              </span>
              <span className={active ? 'font-medium text-text' : 'text-text-dim'}>{entry.labelFr}</span>
              {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {module.isPlaceholder && (
        <div className="mb-6">
          <EmptyState
            title="Contenu provisoire"
            detail="Ce module est marqué comme provisoire dans le catalogue : son contenu n’a pas encore été rédigé par les RH."
            muted
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'lesson' && (
          <motion.section
            key="lesson"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            className="flex flex-1 flex-col"
          >
            <div className={`${CARD} mb-6 flex-1 whitespace-pre-wrap p-6 text-sm leading-relaxed text-text`}>
              {module.contentFr}
            </div>

            {module.best && (
              <p className="mb-4 text-sm text-text-dim">
                Votre meilleur résultat sur ce module :{' '}
                <span className={module.best.passed ? 'font-medium text-status-green' : 'font-medium text-status-amber'}>
                  {module.best.score} %
                </span>{' '}
                (seuil {module.passingScore} %).
              </p>
            )}

            {hasQuiz ? (
              <button
                type="button"
                onClick={() => setStep('quiz')}
                className="self-start rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
              >
                {module.best ? 'Repasser le questionnaire' : 'Passer au questionnaire'}
              </button>
            ) : (
              <EmptyState
                title="Pas de questionnaire"
                detail="Ce module ne comporte pas encore de questions : il n’y a donc rien à valider et aucune attestation à délivrer."
                muted
              />
            )}
          </motion.section>
        )}

        {step === 'quiz' && hasQuiz && (
          <motion.form
            key="quiz"
            onSubmit={handleSubmit}
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            className="flex flex-1 flex-col"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-sm text-text-dim">
                {answered} / {module.questions.length} question(s) répondue(s) · seuil de réussite{' '}
                {module.passingScore} %
              </p>
              <button
                type="button"
                onClick={() => setStep('lesson')}
                className="text-sm font-medium text-red-brand hover:underline"
              >
                Relire le contenu
              </button>
            </div>

            <motion.div
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="mb-6 space-y-4"
            >
              {module.questions.map((question, index) => (
                <motion.fieldset key={question.id} variants={staggerItem} className={`${CARD} p-5`}>
                  <legend className="mb-3 px-1 text-sm font-medium text-text">
                    {index + 1}. {question.promptFr}
                  </legend>
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-app border px-3 py-2 text-sm transition-colors',
                          answers[question.id] === option.id
                            ? 'border-red-brand bg-red-brand/5 text-text'
                            : 'border-border text-text-dim hover:border-red-brand/50',
                        )}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={answers[question.id] === option.id}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                          className="accent-[var(--color-red-brand)]"
                        />
                        {option.labelFr}
                      </label>
                    ))}
                  </div>
                </motion.fieldset>
              ))}
            </motion.div>

            {formError && (
              <p className="mb-4 rounded-app border border-status-red/40 bg-status-red/5 px-4 py-2 text-sm text-status-red">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="self-start rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
            >
              {submitting ? 'Correction en cours…' : 'Valider mes réponses'}
            </button>
          </motion.form>
        )}

        {step === 'result' && outcome && (
          <motion.section
            key="result"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="flex flex-1 flex-col"
          >
            <div
              className={cn(
                'flex flex-wrap items-center gap-8 rounded-app border p-6 shadow-app',
                outcome.passed ? 'border-status-green/40 bg-status-green/5' : 'border-status-red/40 bg-status-red/5',
              )}
            >
              <ProgressRing percent={outcome.score} tone={outcome.passed ? 'green' : 'red'} />
              <div>
                <h2
                  className={cn(
                    'font-display text-2xl',
                    outcome.passed ? 'text-status-green' : 'text-status-red',
                  )}
                >
                  {outcome.passed ? 'Module validé' : 'Seuil non atteint'}
                </h2>
                <p className="mt-1 text-sm text-text-dim">
                  {outcome.correct} bonne(s) réponse(s) sur {outcome.total} · seuil {module.passingScore} %
                </p>
                {outcome.certified && (
                  <p className="mt-2 text-sm font-medium text-status-green">
                    Attestation enregistrée à votre nom.
                  </p>
                )}
                {outcome.passed && !outcome.certified && (
                  <p className="mt-2 text-sm text-text-dim">
                    Ce module était déjà validé : l’attestation existante conserve sa date d’origine.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {!outcome.passed && (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
                >
                  Réessayer
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep('lesson')}
                className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
              >
                Relire le contenu
              </button>
              {outcome.passed && (
                <Link
                  to="/app/me/training/certificates"
                  className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
                >
                  Voir mon attestation
                </Link>
              )}
              <Link
                to="/app/me/training"
                className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                Retour aux modules
              </Link>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
