import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { surveysApi } from '../../../api/surveys.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * The five indicators of the satisfaction survey, mirroring the server's SurveyIndicator
 * enum. The help key says what the question is actually asking, so a 3 means the same thing
 * to two different recruits.
 */
const INDICATORS = [
  { id: 'WELCOME_QUALITY', labelKey: 'me.surveys.indicators.welcomeQuality.label', helpKey: 'me.surveys.indicators.welcomeQuality.help' },
  { id: 'SUPPORT_LEVEL', labelKey: 'me.surveys.indicators.supportLevel.label', helpKey: 'me.surveys.indicators.supportLevel.help' },
  { id: 'ROLE_CLARITY', labelKey: 'me.surveys.indicators.roleClarity.label', helpKey: 'me.surveys.indicators.roleClarity.help' },
  { id: 'MANAGER_RELATIONSHIP', labelKey: 'me.surveys.indicators.managerRelationship.label', helpKey: 'me.surveys.indicators.managerRelationship.help' },
  { id: 'WORKING_CONDITIONS', labelKey: 'me.surveys.indicators.workingConditions.label', helpKey: 'me.surveys.indicators.workingConditions.help' },
];

const SCALE = [
  { value: 1, labelKey: 'me.surveys.scale.veryDissatisfied' },
  { value: 2, labelKey: 'me.surveys.scale.dissatisfied' },
  { value: 3, labelKey: 'me.surveys.scale.neutral' },
  { value: 4, labelKey: 'me.surveys.scale.satisfied' },
  { value: 5, labelKey: 'me.surveys.scale.verySatisfied' },
];

const INDICATOR_LABEL_KEYS = Object.fromEntries(INDICATORS.map((entry) => [entry.id, entry.labelKey]));

/**
 * /app/me/surveys — Mes enquêtes (route guide §2.1, SITE).
 * "Pending and completed surveys (D+07/30/60/90), answer form, confirmation."
 *
 * The rounds and their open/overdue state come from GET /surveys/me, which computes both
 * server-side from the round's due date — this page does not decide whether a survey is open,
 * it renders what the server says. That matters because POST /surveys/responses re-checks
 * `isOpen` and would refuse a submission this page had wrongly enabled.
 *
 * A completed round shows the answers that were given, per indicator: a satisfaction survey
 * you cannot re-read is a survey you answer carelessly the second time.
 */
export default function SurveysPage() {
  const { t, i18n } = useTranslation();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [activeRoundId, setActiveRoundId] = useState(null);
  const [scores, setScores] = useState({});
  const [commentFr, setCommentFr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await surveysApi.myRounds();
      setRounds(data);
    } catch {
      setError(t('me.surveys.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 20 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 });
    },
    [loading, rounds],
  );

  const summary = useMemo(
    () => ({
      total: rounds.length,
      answered: rounds.filter((round) => round.answeredAt).length,
      open: rounds.filter((round) => round.open && !round.answeredAt).length,
      overdue: rounds.filter((round) => round.overdue && !round.answeredAt).length,
    }),
    [rounds],
  );

  function startRound(round) {
    setActiveRoundId(round.id);
    setScores({});
    setCommentFr('');
    setNotice(null);
  }

  async function submit(round) {
    if (Object.keys(scores).length === 0) {
      setNotice({ tone: 'error', text: t('me.surveys.needAtLeastOne') });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      await surveysApi.submitResponse({ roundId: round.id, scores, commentFr });
      setActiveRoundId(null);
      await load();
      setNotice({
        tone: 'ok',
        text: t('me.surveys.submitSuccess', { dayOffset: round.dayOffset }),
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof ApiError && err.body?.message ? err.body.message : t('me.surveys.submitFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label={t('me.surveys.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.surveys.title')}
        subtitle={t('me.surveys.subtitle')}
      />

      {rounds.length === 0 ? (
        <EmptyState title={t('me.surveys.emptyTitle')} detail={t('me.surveys.emptyDetail')} muted />
      ) : (
        <>
          <div data-gsap="band" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label={t('me.surveys.figures.total')} value={summary.total} />
            <Figure label={t('me.surveys.figures.answered')} value={summary.answered} />
            <Figure label={t('me.surveys.figures.open')} value={summary.open} tone={summary.open > 0 ? 'red' : undefined} />
            <Figure label={t('me.surveys.figures.overdue')} value={summary.overdue} tone={summary.overdue > 0 ? 'red' : undefined} />
          </div>

          <AnimatePresence>
            {notice && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'mb-4 overflow-hidden rounded-app border px-4 py-2 text-sm',
                  notice.tone === 'ok'
                    ? 'border-status-green/40 bg-status-green/5 text-status-green'
                    : 'border-status-red/40 bg-status-red/5 text-status-red',
                )}
              >
                {notice.text}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.ul
            data-gsap="band"
            variants={staggerContainer(0.06, 0.15)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="flex-1 space-y-3"
          >
            {rounds.map((round) => (
              <motion.li
                key={round.id}
                variants={staggerItem}
                className={cn(
                  CARD,
                  'p-5',
                  round.answeredAt ? 'border-status-green/40' : round.overdue ? 'border-status-red/40' : '',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg text-text">
                        {t('me.surveys.roundTitle', { dayOffset: round.dayOffset })}
                      </h2>
                      <StatusPill round={round} />
                    </div>
                    <p className="text-sm text-text-dim">
                      {t('me.surveys.dueDate', { date: new Date(round.dueDate).toLocaleDateString(localeOf(i18n)) })}
                      {round.answeredAt
                        ? ` · ${t('me.surveys.answeredOn', { date: new Date(round.answeredAt).toLocaleDateString(localeOf(i18n)) })}`
                        : ''}
                    </p>
                  </div>

                  {!round.answeredAt && round.open && activeRoundId !== round.id && (
                    <button
                      type="button"
                      onClick={() => startRound(round)}
                      className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
                    >
                      {t('me.surveys.answerAction')}
                    </button>
                  )}
                </div>

                {/* A completed round: what was answered. */}
                {round.answeredAt && round.responses.length > 0 && (
                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {round.responses.map((response) => (
                      <div key={response.indicator}>
                        <dt className="text-xs text-text-dim">
                          {INDICATOR_LABEL_KEYS[response.indicator]
                            ? t(INDICATOR_LABEL_KEYS[response.indicator])
                            : response.indicator}
                        </dt>
                        <dd className="text-sm font-medium text-text">
                          {t('me.surveys.scoreOutOfFive', { score: response.score })}
                          <span className="ml-2 font-normal text-text-dim">
                            {(() => {
                              const scaleKey = SCALE.find((entry) => entry.value === response.score)?.labelKey;
                              return scaleKey ? t(scaleKey) : null;
                            })()}
                          </span>
                        </dd>
                      </div>
                    ))}
                    {round.responses.find((response) => response.commentFr) && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <dt className="text-xs text-text-dim">{t('me.surveys.yourComment')}</dt>
                        <dd className="whitespace-pre-wrap text-sm text-text-dim">
                          {round.responses.find((response) => response.commentFr).commentFr}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {!round.answeredAt && !round.open && (
                  <p className="mt-3 text-sm text-text-dim">{t('me.surveys.notYetOpen')}</p>
                )}

                <AnimatePresence initial={false}>
                  {activeRoundId === round.id && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-5 border-t border-border pt-4">
                        {INDICATORS.map((indicator) => (
                          <fieldset key={indicator.id}>
                            <legend className="text-sm font-medium text-text">{t(indicator.labelKey)}</legend>
                            <p className="mb-2 text-xs text-text-dim">{t(indicator.helpKey)}</p>
                            <div className="flex flex-wrap gap-2">
                              {SCALE.map((entry) => (
                                <button
                                  key={entry.value}
                                  type="button"
                                  aria-pressed={scores[indicator.id] === entry.value}
                                  onClick={() =>
                                    setScores((current) => ({ ...current, [indicator.id]: entry.value }))
                                  }
                                  className={cn(
                                    'rounded-app border px-3 py-1.5 text-xs font-medium transition-colors',
                                    scores[indicator.id] === entry.value
                                      ? 'border-red-brand bg-red-brand text-white'
                                      : 'border-border text-text-dim hover:border-red-brand hover:text-red-brand',
                                  )}
                                >
                                  {entry.value} · {t(entry.labelKey)}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ))}

                        <label className="block text-sm text-text-muted">
                          {t('me.surveys.commentLabel')}
                          <textarea
                            value={commentFr}
                            onChange={(event) => setCommentFr(event.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder={t('me.surveys.commentPlaceholder')}
                            className="mt-1 w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => submit(round)}
                            className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                          >
                            {submitting ? t('common.states.sending') : t('me.surveys.submitAction')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRoundId(null)}
                            className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
                          >
                            {t('common.actions.cancel')}
                          </button>
                          <span className="self-center text-xs text-text-dim">
                            {t('me.surveys.indicatorsFilled', { count: Object.keys(scores).length, total: INDICATORS.length })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </div>
  );
}

function StatusPill({ round }) {
  const { t } = useTranslation();

  if (round.answeredAt) {
    return (
      <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
        {t('me.surveys.status.answered')}
      </span>
    );
  }
  if (round.overdue) {
    return (
      <span className="rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-medium text-status-red">
        {t('me.surveys.status.overdue')}
      </span>
    );
  }
  if (round.open) {
    return (
      <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
        {t('me.surveys.status.open')}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
      {t('me.surveys.status.notYetOpen')}
    </span>
  );
}

function Figure({ label, value, tone }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={cn('font-display text-3xl', tone === 'red' ? 'text-status-red' : 'text-red-deep')}>
        <CountUp value={value} />
      </p>
    </div>
  );
}
