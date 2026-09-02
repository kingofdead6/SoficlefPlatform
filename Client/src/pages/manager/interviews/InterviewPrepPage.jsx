import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const EVAL_STATUS_LABELS = { DUE: 'À faire', DRAFT: 'Brouillon', SUBMITTED: 'Transmise' };

/**
 * /app/manager/interviews/[id] (route guide §2.2, CORE).
 * "Agent 4 generates a discussion canvas from progress, quiz scores and survey answers;
 * editable, printable." No LLM/narrative generator exists in this codebase (ADR-003 —
 * no provider is called anywhere), so the canvas is assembled from the same structured
 * facts Agent 4 would draw from (training results, survey rounds, evaluations), rendered
 * as an editable/printable note rather than a fabricated narrative.
 *
 * Sections reveal as an editorial "unveiling" (Framer Motion, staggered by section). All
 * animated wrappers carry print:opacity-100 / print:translate-y-0 / print:h-auto so a mid
 * -transition or reduced-opacity state can never be captured by window.print().
 */
export default function InterviewPrepPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const printRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerInterview(userId);
        setData(data);
      } catch {
        setError('Introuvable.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <PageLoading label="Préparation du dossier…" />;
  if (error && !data) return <PageError message={error} />;
  if (!data) return null;

  const { instance } = data;

  const sectionClass = 'mb-4 rounded-app border border-border bg-surface p-5 shadow-app print:opacity-100 print:translate-y-0';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to={`/app/manager/recruits/${userId}`} className="text-sm text-red-brand hover:underline">
          ← Retour à {data.displayName}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
        >
          Imprimer
        </button>
      </div>

      <div ref={printRef}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 border-b border-border pb-6 print:opacity-100 print:translate-y-0"
        >
          <h1 className="mb-1 font-display text-3xl text-red-deep">Préparation d'entretien</h1>
          <p className="font-display text-xl text-text">{data.displayName}</p>
          <p className="mt-1 text-text-dim">{data.positionFr ?? 'Poste non renseigné'}</p>
        </motion.div>

        {instance && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={sectionClass}
          >
            <h2 className="mb-2 font-display text-lg text-text">Parcours</h2>
            <p className="text-sm text-text-dim">
              Modèle : {instance.templateFr ?? '—'} · Démarré le {new Date(instance.startDate).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-sm text-text-dim">Situation d'essai : {instance.probationOutcome}</p>
          </motion.section>
        )}

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.08 }}
          className={sectionClass}
        >
          <h2 className="mb-2 font-display text-lg text-text">Résultats de formation</h2>
          <ul className="space-y-1 text-sm">
            {data.trainingResults.map((result, index) => (
              <li key={index} className="flex items-center justify-between">
                <span className="text-text-dim">
                  {result.moduleFr} {result.mandatory ? '(obligatoire)' : ''}
                </span>
                <span className={result.passed ? 'text-status-green' : 'text-status-red'}>
                  {result.score}% {result.passed ? '— réussi' : '— échec'}
                </span>
              </li>
            ))}
          </ul>
          {data.trainingResults.length === 0 && <EmptyState detail="Aucun résultat." muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.16 }}
          className={sectionClass}
        >
          <h2 className="mb-2 font-display text-lg text-text">Enquêtes de satisfaction</h2>
          <ul className="space-y-1 text-sm">
            {data.surveyRounds.map((round) => (
              <li key={round.dayOffset} className="flex items-center justify-between">
                <span className="text-text-dim">J+{round.dayOffset}</span>
                <span className={round.answered ? 'text-status-green' : 'text-text-dim'}>
                  {round.answered ? 'Répondu' : 'Sans réponse'}
                </span>
              </li>
            ))}
          </ul>
          {data.surveyRounds.length === 0 && <EmptyState detail="Aucune enquête." muted />}
        </motion.section>

        {instance?.evaluations?.length > 0 && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.24 }}
            className={sectionClass}
          >
            <h2 className="mb-2 font-display text-lg text-text">Évaluations</h2>
            <ul className="space-y-1 text-sm">
              {instance.evaluations.map((evaluation) => (
                <li key={evaluation.id} className="flex items-center justify-between">
                  <span className="text-text-dim">{evaluation.milestone}</span>
                  <span className="text-text-dim">{EVAL_STATUS_LABELS[evaluation.status]}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.3 }}
          className={`${sectionClass} print:hidden`}
        >
          <h2 className="mb-2 font-display text-lg text-text">Notes d'entretien</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Points à aborder, observations…"
            className="w-full rounded-app border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
          />
        </motion.section>
        {notes && (
          <section className="hidden rounded-app border border-border bg-surface p-4 shadow-app print:block">
            <h2 className="mb-2 font-medium text-text">Notes d'entretien</h2>
            <p className="whitespace-pre-wrap text-sm text-text-dim">{notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
