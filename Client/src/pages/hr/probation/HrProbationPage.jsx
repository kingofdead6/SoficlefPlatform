import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * The three outcomes HR may record, with the tone each carries. Kept in this order so the
 * least destructive option is always leftmost and terminating is never the default target
 * of a stray click.
 */
const OUTCOMES = [
  { id: 'CONFIRMED', tone: 'green' },
  { id: 'EXTENDED', tone: 'amber' },
  { id: 'TERMINATED', tone: 'red' },
];

const OUTCOME_LABELS = {
  CONFIRMED: 'Confirmation',
  EXTENDED: 'Prolongation',
  TERMINATED: 'Fin de période d’essai',
};

const TONE_STYLE = {
  green: 'border-status-green/50 bg-status-green/10 text-status-green',
  amber: 'border-status-amber/50 bg-status-amber/10 text-status-amber',
  red: 'border-status-red/50 bg-status-red/10 text-status-red',
};

const TONE_OF_OUTCOME = { CONFIRMED: 'green', EXTENDED: 'amber', TERMINATED: 'red' };

const CRITERIA = [
  { key: 'scoreSkills' },
  { key: 'scoreAutonomy' },
  { key: 'scoreIntegration' },
  { key: 'scoreBehaviour' },
];

/** Percentage bar with the two decision boundaries drawn on it, so a borderline case reads. */
function ScoreBar({ percent, tone }) {
  const reduce = useReducedMotion();
  const fill =
    tone === 'green' ? 'bg-status-green' : tone === 'amber' ? 'bg-status-amber' : 'bg-status-red';

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <motion.div
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`h-full ${fill}`}
      />
      {/* 30 % and 60 % boundaries, from the same THRESHOLDS the server applies. */}
      {[30, 60].map((mark) => (
        <span
          key={mark}
          aria-hidden
          className="absolute top-0 h-full w-px bg-border"
          style={{ left: `${mark}%` }}
        />
      ))}
    </div>
  );
}

function DecisionHistory({ instanceId }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    onboardingApi
      .probationDecisions(instanceId)
      .then((res) => alive && setRows(res.data ?? []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [instanceId]);

  if (rows === null) return <p className="text-xs text-text-dim">Chargement de l’historique…</p>;
  if (rows.length === 0) return <p className="text-xs text-text-dim">Aucune décision enregistrée.</p>;

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="border-s-2 border-border ps-3 text-xs">
          <p className="font-medium text-text">
            {OUTCOME_LABELS[row.decidedOutcome] ?? row.decidedOutcome}
            {row.decidedOutcome !== row.suggestedOutcome && (
              <span className="ms-2 rounded-full bg-status-amber/10 px-2 py-0.5 text-[10px] font-medium text-status-amber">
                différente de la suggestion
              </span>
            )}
          </p>
          <p className="text-text-dim">
            {row.scorePercent}% · {row.decidedBy?.displayName ?? '—'} ·{' '}
            {new Date(row.decidedAt).toLocaleString('fr-FR')}
          </p>
          {row.reasonFr && <p className="mt-0.5 text-text-dim">Motif : {row.reasonFr}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * One recruit awaiting a decision.
 *
 * The interaction is deliberately asymmetric. Agreeing with the suggestion is one click.
 * Choosing anything else reveals a required reason before the confirm button enables, and
 * terminating always passes through an explicit confirmation step regardless of whether it
 * was the suggestion — an irreversible, person-affecting action should never be one stray
 * click away.
 */
function ProbationCard({ entry, onDecided }) {
  const [choice, setChoice] = useState(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  const suggestion = entry.suggestedOutcome;
  const diverges = choice !== null && choice !== suggestion;
  const reasonMissing = diverges && reason.trim().length === 0;
  const needsConfirm = choice === 'TERMINATED';

  const responsableAgrees =
    entry.evaluation.recommendedOutcome === null
      ? null
      : entry.evaluation.recommendedOutcome === suggestion;

  async function submit() {
    if (reasonMissing) return;
    setSaving(true);
    setError(null);
    try {
      await onboardingApi.decideProbation({
        instanceId: entry.instanceId,
        decidedOutcome: choice,
        reasonFr: reason.trim() || undefined,
      });
      onDecided();
    } catch (err) {
      setError(err?.body?.message ?? err?.message ?? 'La décision n’a pas pu être enregistrée.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  function pick(outcome) {
    setChoice((current) => (current === outcome ? null : outcome));
    setConfirming(false);
    setError(null);
  }

  const tone = TONE_OF_OUTCOME[suggestion] ?? 'amber';

  return (
    <motion.article variants={staggerItem} className={`${CARD} p-5`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-text">{entry.subject.displayName}</h3>
          <p className="text-sm text-text-dim">
            {entry.subject.positionFr ?? 'Poste non renseigné'}
            {entry.subject.directionFr ? ` · ${entry.subject.directionFr}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-text-dim">
            Évalué par {entry.responsable?.displayName ?? 'responsable non renseigné'}
            {entry.evaluation.submittedAt
              ? ` · transmis le ${new Date(entry.evaluation.submittedAt).toLocaleDateString('fr-FR')}`
              : ''}
          </p>
        </div>

        <div className="text-end">
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={entry.scorePercent} suffix=" %" />
          </p>
          <p className="text-xs text-text-dim">{entry.evaluation.total} / 20</p>
        </div>
      </div>

      <div className="mb-4">
        <ScoreBar percent={entry.scorePercent} tone={tone} />
        <div className="mt-1 flex justify-between text-[10px] text-text-dim">
          <span>0 %</span>
          <span>30 % · 60 %</span>
          <span>100 %</span>
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {CRITERIA.map((criterion) => (
          <div key={criterion.key}>
            <dt className="text-xs text-text-dim">{criterion.labelFr}</dt>
            <dd className="font-mono text-text">{entry.evaluation[criterion.key]} / 5</dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-border py-3 text-sm">
        <span className={`rounded-app border px-2 py-1 text-xs font-medium ${TONE_STYLE[tone]}`}>
          Suggestion : {OUTCOME_LABELS[suggestion]}
        </span>
        {entry.evaluation.recommendedOutcome && (
          <span className="rounded-app border border-border px-2 py-1 text-xs text-text-dim">
            Avis du responsable : {OUTCOME_LABELS[entry.evaluation.recommendedOutcome]}
          </span>
        )}
        {responsableAgrees === false && (
          <span className="text-xs font-medium text-status-amber">
            Le responsable ne rejoint pas la suggestion.
          </span>
        )}
      </div>

      <p className="mb-2 text-xs text-text-dim">
        La suggestion est calculée à partir des notes. C’est vous qui tranchez.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {OUTCOMES.map((outcome) => {
          const active = choice === outcome.id;
          const isSuggested = outcome.id === suggestion;
          return (
            <button
              key={outcome.id}
              type="button"
              onClick={() => pick(outcome.id)}
              aria-pressed={active}
              className={`rounded-app border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? TONE_STYLE[outcome.tone]
                  : 'border-border text-text-dim hover:border-red-brand hover:text-red-brand'
              }`}
            >
              {outcome.labelFr}
              {isSuggested && (
                <span className="ms-1.5 text-[10px] font-normal opacity-70">suggéré</span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {diverges && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <label className="block pt-1">
              <span className="mb-1 block text-sm font-medium text-text">
                Motif <span className="font-normal text-text-dim">— requis</span>
              </span>
              <span className="mb-2 block text-xs text-text-dim">
                Votre décision s’écarte de la suggestion ({OUTCOME_LABELS[suggestion]}). Expliquez
                pourquoi : c’est ce motif qui rendra la décision compréhensible plus tard.
              </span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${field} w-full`}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {choice && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {needsConfirm && !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={reasonMissing}
              className="rounded-app bg-status-red px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Mettre fin à la période d’essai…
            </button>
          ) : needsConfirm && confirming ? (
            <>
              <span className="text-sm text-status-red">
                Confirmer la fin de période d’essai de {entry.subject.displayName} ?
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={saving || reasonMissing}
                className="rounded-app bg-status-red px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Oui, confirmer'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-app border border-border px-3 py-2 text-sm text-text-dim hover:bg-surface-2"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || reasonMissing}
              className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : `Enregistrer : ${OUTCOME_LABELS[choice]}`}
            </button>
          )}

          {reasonMissing && (
            <span className="text-xs text-status-amber">Le motif est requis pour enregistrer.</span>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-status-red">{error}</p>}

      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-text-dim hover:text-red-brand">
          Historique des décisions
        </summary>
        <div className="mt-2">
          <DecisionHistory instanceId={entry.instanceId} />
        </div>
      </details>
    </motion.article>
  );
}

/**
 * /app/hr/probation (route guide §2.3 / §2.5).
 *
 * HR sees the *result* of each evaluation — scores, percentage, suggested outcome and the
 * responsable's own recommendation — and records the decision. It never shows the
 * evaluation form: scoring belongs to the responsable, deciding belongs to HR, and keeping
 * those apart on screen is what keeps them apart in practice.
 */
export default function HrProbationPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await onboardingApi.probationQueue();
      setEntries(data ?? []);
    } catch {
      setError('Impossible de charger les périodes d’essai à valider.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const by = { CONFIRMED: 0, EXTENDED: 0, TERMINATED: 0 };
    for (const entry of entries) {
      if (entry.suggestedOutcome in by) by[entry.suggestedOutcome] += 1;
    }
    return by;
  }, [entries]);

  if (loading) return <PageLoading label={t('hr.probation.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.probation.title')}
        subtitle={t('hr.probation.subtitle')}
      />

      <div className="mb-8 rounded-app border border-border bg-surface-2 p-4 text-sm text-text-dim">
        <p className="font-medium text-text">{t('hr.probation.noticeTitle')}</p>
        <p className="mt-1">
          {t('hr.probation.noticeDetail')}
        </p>
      </div>

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.probation.pending')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={entries.length} />
          </p>
        </motion.div>
        {OUTCOMES.map((outcome) => (
          <motion.div key={outcome.id} variants={staggerItem} className={`${CARD} p-5`}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
              {t(`hr.probation.outcomes.${outcome.id}.label`)} {t('hr.probation.suggested')}
            </p>
            <p
              className={`font-display text-3xl ${
                outcome.tone === 'red'
                  ? 'text-status-red'
                  : outcome.tone === 'amber'
                    ? 'text-status-amber'
                    : 'text-status-green'
              }`}
            >
              <CountUp value={counts[outcome.id]} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      {entries.length === 0 ? (
        <EmptyState
          title={t('hr.probation.emptyTitle')}
          detail={t('hr.probation.emptyDetail')}
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.07)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="space-y-5"
        >
          {entries.map((entry) => (
            <ProbationCard key={entry.instanceId} entry={entry} onDecided={load} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
