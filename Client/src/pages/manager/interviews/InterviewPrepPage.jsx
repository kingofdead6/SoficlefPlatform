import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';

const EVAL_STATUS_KEYS = {
  DUE: 'manager.evalStatus.due',
  DRAFT: 'manager.evalStatus.draft',
  SUBMITTED: 'manager.evalStatus.submitted',
};

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
  const { t, i18n } = useTranslation();
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
        setError(t('manager.interview.notFound'));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, t]);

  if (loading) return <PageLoading label={t('manager.interview.loading')} />;
  if (error && !data) return <PageError message={error} />;
  if (!data) return null;

  const { instance } = data;

  const sectionClass = 'mb-4 rounded-app border border-border bg-surface p-5 shadow-app print:opacity-100 print:translate-y-0';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to={`/app/manager/recruits/${userId}`} className="text-sm text-red-brand hover:underline">
          <span aria-hidden className="rtl:-scale-x-100">←</span> {t('manager.backTo', { name: data.displayName })}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
        >
          {t('manager.interview.print')}
        </button>
      </div>

      <div ref={printRef}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 border-b border-border pb-6 print:opacity-100 print:translate-y-0"
        >
          <h1 className="mb-1 font-display text-3xl text-red-deep">{t('manager.interview.title')}</h1>
          <p className="font-display text-xl text-text">{data.displayName}</p>
          <p className="mt-1 text-text-dim">{data.positionFr ?? t('manager.noPosition')}</p>
        </motion.div>

        {instance && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={sectionClass}
          >
            <h2 className="mb-2 font-display text-lg text-text">{t('manager.interview.journey')}</h2>
            <p className="text-sm text-text-dim">
              {t('manager.interview.templateStarted', {
                template: instance.templateFr ?? '—',
                date: new Date(instance.startDate).toLocaleDateString(localeOf(i18n)),
              })}
            </p>
            <p className="text-sm text-text-dim">
              {t('manager.interview.probationStatus', { outcome: instance.probationOutcome })}
            </p>
          </motion.section>
        )}

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.08 }}
          className={sectionClass}
        >
          <h2 className="mb-2 font-display text-lg text-text">{t('manager.interview.trainingResults')}</h2>
          <ul className="space-y-1 text-sm">
            {data.trainingResults.map((result, index) => (
              <li key={index} className="flex items-center justify-between">
                <span className="text-text-dim">
                  {result.moduleFr} {result.mandatory ? t('manager.interview.mandatoryTag') : ''}
                </span>
                <span className={result.passed ? 'text-status-green' : 'text-status-red'}>
                  {result.score}% {result.passed ? t('manager.interview.passedTag') : t('manager.interview.failedTag')}
                </span>
              </li>
            ))}
          </ul>
          {data.trainingResults.length === 0 && <EmptyState detail={t('manager.interview.noResults')} muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.16 }}
          className={sectionClass}
        >
          <h2 className="mb-2 font-display text-lg text-text">{t('manager.interview.surveys')}</h2>
          <ul className="space-y-1 text-sm">
            {data.surveyRounds.map((round) => (
              <li key={round.dayOffset} className="flex items-center justify-between">
                <span className="text-text-dim">{t('manager.dayPlus', { count: round.dayOffset })}</span>
                <span className={round.answered ? 'text-status-green' : 'text-text-dim'}>
                  {round.answered ? t('manager.interview.answered') : t('manager.interview.notAnswered')}
                </span>
              </li>
            ))}
          </ul>
          {data.surveyRounds.length === 0 && <EmptyState detail={t('manager.interview.noSurveys')} muted />}
        </motion.section>

        {instance?.evaluations?.length > 0 && (
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.24 }}
            className={sectionClass}
          >
            <h2 className="mb-2 font-display text-lg text-text">{t('manager.evaluations.title')}</h2>
            <ul className="space-y-1 text-sm">
              {instance.evaluations.map((evaluation) => (
                <li key={evaluation.id} className="flex items-center justify-between">
                  <span className="text-text-dim">{evaluation.milestone}</span>
                  <span className="text-text-dim">
                    {EVAL_STATUS_KEYS[evaluation.status] ? t(EVAL_STATUS_KEYS[evaluation.status]) : evaluation.status}
                  </span>
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
          <h2 className="mb-2 font-display text-lg text-text">{t('manager.interview.notes')}</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder={t('manager.interview.notesPlaceholder')}
            className="w-full rounded-app border border-border px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
          />
        </motion.section>
        {notes && (
          <section className="hidden rounded-app border border-border bg-surface p-4 shadow-app print:block">
            <h2 className="mb-2 font-medium text-text">{t('manager.interview.notes')}</h2>
            <p className="whitespace-pre-wrap text-sm text-text-dim">{notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
