import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';
import {
  OWNER_DEPARTMENTS,
  STATUS_LABELS,
  STATUS_STYLES,
  TASK_PHASES,
} from './taskVocabulary.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * The transitions a recruit may ask for from each state.
 *
 * Deliberately narrower than the server's own transition table: VALIDATED is a manager's
 * word, not the recruit's, so it is not offered here and a validated task offers nothing at
 * all. Making a button the server would refuse is worse than not making it.
 */
const NEXT_STATUSES = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
  IN_PROGRESS: ['TODO', 'BLOCKED', 'DONE'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'DONE'],
  DONE: ['TODO', 'IN_PROGRESS', 'BLOCKED'],
  VALIDATED: [],
};

/**
 * /app/me/journey — My Path (route guide §2.1, CORE).
 * "Roadmap grouped by phase; open a task, read instructions, upload a required document,
 * mark as done, request help; blocked tasks show the responsible department."
 *
 * Grouping is by `milestone.phase` (PRE_ONBOARDING / DAY_ONE / PROBATION), the same enum the
 * HR template builder writes, so the recruit's roadmap is split exactly where HR designed it
 * to be. Tasks the template left without a phase get their own trailing group rather than
 * being silently folded into one of the three — an unphased milestone is a template gap, and
 * hiding it would hide the gap.
 *
 * "Open a task / upload a document / request help" all live on the task detail page
 * (/app/me/journey/[taskId]); this page carries the two actions that make sense in a list —
 * marking progress, and flagging a blockage with the department that owns it.
 */
export default function JourneyPage() {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await onboardingApi.journey();
      setJourney(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setJourney(null);
      else setError("Impossible de charger votre parcours d'intégration.");
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
    [loading, journey],
  );

  /** The roadmap, split into the phases the template declares, in chronological order. */
  const groups = useMemo(() => {
    if (!journey) return [];

    const buckets = new Map(TASK_PHASES.map((phase) => [phase.id, []]));
    const unphased = [];

    for (const task of journey.tasks) {
      if (task.phase && buckets.has(task.phase)) buckets.get(task.phase).push(task);
      else unphased.push(task);
    }

    const ordered = TASK_PHASES.map((phase) => ({ ...phase, tasks: buckets.get(phase.id) })).filter(
      (group) => group.tasks.length > 0,
    );

    if (unphased.length > 0) {
      ordered.push({
        id: 'UNPHASED',
        labelFr: 'Étapes non rattachées à une phase',
        detailFr: 'Ces étapes n’ont pas de phase déclarée dans le modèle d’intégration.',
        tasks: unphased,
      });
    }

    return ordered;
  }, [journey]);

  const visibleGroups = phaseFilter === 'ALL' ? groups : groups.filter((group) => group.id === phaseFilter);

  async function changeStatus(task, status) {
    if (!journey) return;
    setSavingId(task.milestoneId);
    setNotice(null);
    try {
      await onboardingApi.setTaskStatus({
        instanceId: journey.instanceId,
        milestoneId: task.milestoneId,
        status,
      });
      await load();
      setNotice({ tone: 'ok', textFr: `« ${task.titleFr} » : ${STATUS_LABELS[status].toLowerCase()}.` });
    } catch (err) {
      setNotice({
        tone: 'error',
        textFr:
          err instanceof ApiError && err.body?.message
            ? err.body.message
            : "La mise à jour de l'étape a échoué.",
      });
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <PageLoading label="Chargement de votre parcours…" />;
  if (error) return <PageError message={error} />;

  if (!journey) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          eyebrow="Mon espace"
          title="Mon parcours"
          subtitle="La feuille de route de votre intégration, étape par étape."
        />
        <EmptyState
          title="Aucun parcours enregistré"
          detail="Aucun parcours d’intégration n’est encore rattaché à votre compte. Les RH le créent au moment de votre affectation à un poste."
          muted
        />
      </div>
    );
  }

  const { progress } = journey;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Mon espace"
        title="Mon parcours d’intégration"
        subtitle={journey.templateTitleFr}
        actions={
          <Link
            to="/app/me"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            Tableau de bord
          </Link>
        }
      />

      {/* Band 1 — where the whole path stands. */}
      <div data-gsap="band" className={`mb-8 flex flex-wrap items-center gap-8 ${CARD} p-6`}>
        <ProgressRing
          percent={progress.percent}
          tone={progress.overdue > 0 || progress.blocked > 0 ? 'red' : progress.percent >= 100 ? 'green' : 'brand'}
        />
        <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4">
          <Figure label="Terminées" value={progress.completed} suffix={`/${progress.total}`} />
          <Figure label="En retard" value={progress.overdue} tone={progress.overdue > 0 ? 'red' : undefined} />
          <Figure label="Bloquées" value={progress.blocked} tone={progress.blocked > 0 ? 'red' : undefined} />
          <Figure label="Phases" value={groups.length} />
        </div>
      </div>

      {/* Band 2 — phase filter. */}
      <div data-gsap="band" className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {[{ id: 'ALL', labelFr: 'Toutes les phases' }, ...groups].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPhaseFilter(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              phaseFilter === tab.id
                ? 'border-red-brand text-red-deep'
                : 'border-transparent text-text-dim hover:text-text',
            )}
          >
            {tab.labelFr}
            {tab.tasks ? ` (${tab.tasks.length})` : ''}
          </button>
        ))}
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

      {/* Band 3 — the roadmap itself. */}
      <div data-gsap="band" className="flex-1 space-y-10">
        {visibleGroups.map((group) => (
          <section key={group.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl text-text">{group.labelFr}</h2>
              <span className="text-sm text-text-dim">
                {group.tasks.filter((task) => task.status === 'DONE' || task.status === 'VALIDATED').length}
                /{group.tasks.length}
              </span>
            </div>
            <p className="mb-4 text-xs text-text-dim">{group.detailFr}</p>

            <motion.ul
              variants={staggerContainer(0.05, 0.2)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="space-y-3"
            >
              {group.tasks.map((task) => (
                <motion.li key={task.milestoneId} variants={staggerItem}>
                  <TaskRow
                    task={task}
                    saving={savingId === task.milestoneId}
                    onStatus={(status) => changeStatus(task, status)}
                    reduce={reduce}
                  />
                </motion.li>
              ))}
            </motion.ul>
          </section>
        ))}

        {visibleGroups.length === 0 && (
          <EmptyState detail="Aucune étape dans cette phase." muted />
        )}
      </div>
    </div>
  );
}

function Figure({ label, value, suffix = '', tone }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={cn('font-display text-2xl', tone === 'red' ? 'text-status-red' : 'text-red-deep')}>
        <CountUp value={value} />
        {suffix && <span className="text-base text-text-dim">{suffix}</span>}
      </p>
    </div>
  );
}

function TaskRow({ task, saving, onStatus, reduce }) {
  const owner = OWNER_DEPARTMENTS[task.ownerDepartment];
  const blocked = task.status === 'BLOCKED';

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-app border bg-surface p-4 shadow-app transition-colors',
        blocked || task.overdue ? 'border-status-red/40' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-muted">{task.dayLabelFr}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[task.status])}>
              {STATUS_LABELS[task.status]}
            </span>
            {task.overdue && <span className="text-xs font-medium text-status-red">En retard</span>}
            {task.dueSoon && !task.overdue && (
              <span className="text-xs font-medium text-status-amber">Échéance proche</span>
            )}
            {!task.isRecommended && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">Facultative</span>
            )}
          </div>

          <Link
            to={`/app/me/journey/${task.milestoneId}`}
            className="font-medium text-text transition-colors hover:text-red-brand"
          >
            {task.titleFr}
          </Link>
          <p className="mt-1 text-sm text-text-dim">{task.detailFr}</p>

          {task.dueDate && (
            <p className="mt-1 text-xs text-text-muted">
              Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR')}
            </p>
          )}

          {/*
            §2.1: "blocked tasks show the responsible department". The department comes from
            the milestone's own ownerDepartment, so it names who actually owns the step
            rather than defaulting to the RH for everything. Without one declared, that gap
            is stated as such — a wrong contact costs more than a missing one.
          */}
          {blocked && (
            <p className="mt-2 rounded-app border border-status-red/30 bg-status-red/5 px-3 py-2 text-xs text-status-red">
              {owner
                ? `Cette étape est bloquée. Service responsable : ${owner.labelFr} — ${owner.detailFr}`
                : 'Cette étape est bloquée. Aucun service responsable n’est déclaré sur cette étape : signalez-le à votre manager.'}{' '}
              <Link to={`/app/me/journey/${task.milestoneId}`} className="font-medium underline">
                Demander de l’aide
              </Link>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {NEXT_STATUSES[task.status]?.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              {NEXT_STATUSES[task.status].map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={saving}
                  onClick={() => onStatus(status)}
                  className={cn(
                    'rounded-app border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                    status === 'DONE'
                      ? 'border-red-brand bg-red-brand text-white hover:bg-red-light'
                      : 'border-border text-text hover:border-red-brand hover:text-red-brand',
                  )}
                >
                  {status === 'DONE' ? 'Marquer terminée' : STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-text-dim">Validée par votre manager</span>
          )}

          <Link
            to={`/app/me/journey/${task.milestoneId}`}
            className="text-xs font-medium text-red-brand hover:underline"
          >
            Ouvrir l’étape →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
