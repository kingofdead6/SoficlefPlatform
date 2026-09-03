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
      setError('Impossible de charger vos enquêtes.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setNotice({ tone: 'error', textFr: 'Répondez à au moins un indicateur avant d’envoyer.' });
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
        textFr: `Merci. Votre réponse à l’enquête J+${round.dayOffset} a bien été enregistrée.`,
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        textFr:
          err instanceof ApiError && err.body?.message ? err.body.message : "L'envoi de votre réponse a échoué.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement de vos enquêtes…" />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Mon espace"
        title="Mes enquêtes de satisfaction"
        subtitle="Quatre points d’étape — J+7, J+30, J+60 et J+90 — pour dire comment se passe votre intégration. Vos réponses individuelles ne sont pas affichées nominativement dans les tableaux de bord RH."
      />

      {rounds.length === 0 ? (
        <EmptyState
          title="Aucune enquête programmée"
          detail="Les points d’étape sont créés en même temps que votre parcours d’intégration."
          muted
        />
      ) : (
        <>
          <div data-gsap="band" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Points d’étape" value={summary.total} />
            <Figure label="Répondus" value={summary.answered} />
            <Figure label="Ouverts" value={summary.open} tone={summary.open > 0 ? 'red' : undefined} />
            <Figure label="En retard" value={summary.overdue} tone={summary.overdue > 0 ? 'red' : undefined} />
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
                {notice.textFr}
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
                      <h2 className="font-display text-lg text-text">Point d’étape J+{round.dayOffset}</h2>
                      <StatusPill round={round} />
                    </div>
                    <p className="text-sm text-text-dim">
                      Échéance : {new Date(round.dueDate).toLocaleDateString('fr-FR')}
                      {round.answeredAt
                        ? ` · répondu le ${new Date(round.answeredAt).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>

                  {!round.answeredAt && round.open && activeRoundId !== round.id && (
                    <button
                      type="button"
                      onClick={() => startRound(round)}
                      className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
                    >
                      Répondre
                    </button>
                  )}
                </div>

                {/* A completed round: what was answered. */}
                {round.answeredAt && round.responses.length > 0 && (
                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {round.responses.map((response) => (
                      <div key={response.indicator}>
                        <dt className="text-xs text-text-dim">
                          {INDICATOR_LABELS[response.indicator] ?? response.indicator}
                        </dt>
                        <dd className="text-sm font-medium text-text">
                          {response.score} / 5
                          <span className="ml-2 font-normal text-text-dim">
                            {SCALE.find((entry) => entry.value === response.score)?.labelFr}
                          </span>
                        </dd>
                      </div>
                    ))}
                    {round.responses.find((response) => response.commentFr) && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <dt className="text-xs text-text-dim">Votre commentaire</dt>
                        <dd className="whitespace-pre-wrap text-sm text-text-dim">
                          {round.responses.find((response) => response.commentFr).commentFr}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {!round.answeredAt && !round.open && (
                  <p className="mt-3 text-sm text-text-dim">
                    Cette enquête s’ouvrira à son échéance : elle mesure votre ressenti à ce moment précis du
                    parcours.
                  </p>
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
                            <legend className="text-sm font-medium text-text">{indicator.labelFr}</legend>
                            <p className="mb-2 text-xs text-text-dim">{indicator.helpFr}</p>
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
                                  {entry.value} · {entry.labelFr}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ))}

                        <label className="block text-sm text-text-muted">
                          Commentaire (facultatif)
                          <textarea
                            value={commentFr}
                            onChange={(event) => setCommentFr(event.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="Ce qui s’est bien passé, ce qui pourrait être amélioré…"
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
                            {submitting ? 'Envoi…' : 'Envoyer ma réponse'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRoundId(null)}
                            className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
                          >
                            Annuler
                          </button>
                          <span className="self-center text-xs text-text-dim">
                            {Object.keys(scores).length} / {INDICATORS.length} indicateurs renseignés
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
  if (round.answeredAt) {
    return (
      <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
        Répondu
      </span>
    );
  }
  if (round.overdue) {
    return (
      <span className="rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-medium text-status-red">
        En retard
      </span>
    );
  }
  if (round.open) {
    return (
      <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">Ouvert</span>
    );
  }
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">Pas encore ouvert</span>
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
