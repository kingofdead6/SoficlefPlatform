import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../api/onboarding.js';
import PageHeader from '../../components/manager/PageHeader.jsx';
import ProgressRing from '../../components/manager/ProgressRing.jsx';
import CountUp from '../../components/manager/CountUp.jsx';
import { PageLoading, PageError } from '../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem } from '../../lib/motion/variants.js';

const STATUS_TONE = (percent, blocked, overdue) => {
  if (blocked > 0 || overdue > 0) return 'red';
  if (percent >= 100) return 'green';
  return 'brand';
};

const SEVERITY_STYLE = {
  red: 'border-status-red/40 bg-status-red/10 text-status-red',
  blue: 'border-red-brand/40 bg-red-brand/10 text-red-deep',
};

const TASK_STATUS_LABELS = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
};

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-xl text-text';

/**
 * /app/manager — Dashboard (route guide §2.2).
 * Flagship manager page: GSAP orchestrates the initial load-in of the page's bands;
 * anime.js drives the per-recruit progress rings and the summary count-ups; Framer Motion
 * handles card/list stagger and hover micro-interactions.
 */
export default function ManagerDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerDashboard();
        setData(data);
      } catch {
        setError('Impossible de charger le tableau de bord.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 24 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 });
    },
    [loading, data],
  );

  const summary = useMemo(() => {
    if (!data) return null;
    const { recruits, alerts, ownTasks } = data;
    const active = recruits.length;
    const averagePercent =
      active === 0 ? 0 : Math.round(recruits.reduce((sum, r) => sum + r.percent, 0) / active);
    const attention = recruits.filter((r) => r.blocked > 0 || r.overdue > 0).length;
    return {
      active,
      averagePercent,
      attention,
      alerts: alerts.length,
      ownTasks: ownTasks.length,
    };
  }, [data]);

  if (loading) return <PageLoading label="Chargement du tableau de bord…" />;
  if (error) return <PageError message={error} />;

  const { recruits, alerts, ownTasks } = data;

  // Sorted so the recruits needing action lead the grid, then least-advanced first.
  const orderedRecruits = [...recruits].sort((a, b) => {
    const aFlag = a.blocked + a.overdue > 0 ? 1 : 0;
    const bFlag = b.blocked + b.overdue > 0 ? 1 : 0;
    if (aFlag !== bFlag) return bFlag - aFlag;
    return a.percent - b.percent;
  });

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Manager"
        title="Tableau de bord"
        subtitle="Vue d'ensemble de vos recrues en intégration, de vos alertes et de vos tâches en attente."
        actions={
          <>
            <Link
              to="/app/manager/calendar"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Calendrier
            </Link>
            <Link
              to="/app/manager/recruits"
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              Toutes les recrues
            </Link>
          </>
        }
      />

      {/* Band 1 — summary strip */}
      <div data-gsap="band" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Recrues actives" value={summary.active} />
        <SummaryTile label="Avancement moyen" value={summary.averagePercent} suffix="%" />
        <SummaryTile label="Demandent attention" value={summary.attention} tone={summary.attention > 0 ? 'red' : undefined} />
        <SummaryTile label="Tâches en attente" value={summary.ownTasks} />
      </div>

      {/* Band 2 — recruits + alerts */}
      <div data-gsap="band" className="mb-10 grid gap-8 lg:grid-cols-3">
        <section className="flex flex-col lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Recrues en cours</h2>
            <span className="text-sm text-text-dim">{recruits.length}</span>
          </div>
          <motion.div
            variants={staggerContainer(0.07, 0.35)}
            initial={reduce ? false : 'hidden'}
            animate="visible"
            className="grid flex-1 auto-rows-min gap-4 sm:grid-cols-2"
          >
            {orderedRecruits.map((recruit) => (
              <motion.div
                key={recruit.userId}
                variants={staggerItem}
                whileHover={reduce ? undefined : { y: -3, boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)' }}
                whileTap={reduce ? undefined : { y: -1 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link to={`/app/manager/recruits/${recruit.userId}`} className={`block ${CARD} p-4 transition-colors hover:border-red-brand`}>
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      percent={recruit.percent}
                      tone={STATUS_TONE(recruit.percent, recruit.blocked, recruit.overdue)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-text">{recruit.displayName}</span>
                        <span className="shrink-0 text-xs text-text-dim">J+{recruit.dayNumber}</span>
                      </div>
                      <p className="truncate text-xs text-text-dim">{recruit.positionFr ?? 'Poste non renseigné'}</p>
                      {(recruit.blocked > 0 || recruit.overdue > 0) && (
                        <span className="mt-1 inline-block text-xs font-medium text-status-red">
                          {recruit.blocked > 0 ? `${recruit.blocked} bloquée(s)` : ''}
                          {recruit.blocked > 0 && recruit.overdue > 0 ? ' · ' : ''}
                          {recruit.overdue > 0 ? `${recruit.overdue} en retard` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {recruits.length === 0 && (
              <div className="col-span-full flex flex-1 items-center justify-center rounded-app border border-dashed border-border py-12 text-sm text-text-dim">
                Aucune recrue en intégration.
              </div>
            )}
          </motion.div>
        </section>

        <section className="flex flex-col">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Alertes</h2>
            <span className="text-sm text-text-dim">{alerts.length}</span>
          </div>
          <motion.div
            variants={staggerContainer(0.06, 0.35)}
            initial={reduce ? false : 'hidden'}
            animate="visible"
            className="flex-1 space-y-2"
          >
            {alerts.map((alert) => (
              <motion.div key={alert.id} variants={staggerItem}>
                <Link
                  to={alert.href}
                  className={`block rounded-app border p-3 text-sm shadow-app transition hover:shadow-app-lifted ${SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.blue}`}
                >
                  <p className="font-medium">{alert.titleFr}</p>
                  <p className="text-xs opacity-80">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
            {alerts.length === 0 && (
              <p className="rounded-app border border-dashed border-border py-6 text-center text-sm text-text-dim">
                Aucune alerte.
              </p>
            )}
          </motion.div>
        </section>
      </div>

      {/* Band 3 — progression table + pending tasks */}
      <div data-gsap="band" className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className={`mb-4 ${SECTION_TITLE}`}>Progression détaillée</h2>
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Collaborateur</th>
                  <th className="px-4 py-3 font-medium">Jour</th>
                  <th className="px-4 py-3 font-medium">Étapes</th>
                  <th className="w-[34%] px-4 py-3 font-medium">Avancement</th>
                </tr>
              </thead>
              <tbody>
                {orderedRecruits.map((recruit) => (
                  <tr key={recruit.userId} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link to={`/app/manager/recruits/${recruit.userId}`} className="text-text hover:text-red-brand">
                        {recruit.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-dim">J+{recruit.dayNumber}</td>
                    <td className="px-4 py-3 text-text-dim">
                      {recruit.done}/{recruit.total}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${recruit.percent}%` }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className={
                              STATUS_TONE(recruit.percent, recruit.blocked, recruit.overdue) === 'red'
                                ? 'h-full bg-status-red'
                                : STATUS_TONE(recruit.percent, recruit.blocked, recruit.overdue) === 'green'
                                  ? 'h-full bg-status-green'
                                  : 'h-full bg-red-brand'
                            }
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right font-mono text-xs text-text-dim">{recruit.percent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recruits.length === 0 && (
              <p className="py-10 text-center text-sm text-text-dim">Aucune recrue à afficher.</p>
            )}
          </div>
        </section>

        <section className="flex flex-col">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Mes tâches</h2>
            <span className="text-sm text-text-dim">{ownTasks.length}</span>
          </div>
          <motion.div
            variants={staggerContainer(0.06, 0.5)}
            initial={reduce ? false : 'hidden'}
            animate="visible"
            className="flex-1 space-y-2"
          >
            {ownTasks.map((task) => (
              <motion.div key={task.id} variants={staggerItem}>
                <Link
                  to={`/app/manager/recruits/${task.instance.user.id}`}
                  className={`block ${CARD} p-3 text-sm transition-colors hover:border-red-brand`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text">{task.titleFr}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-dim">
                    {task.instance.user.displayName}
                    {task.dueDate ? ` — échéance ${new Date(task.dueDate).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </Link>
              </motion.div>
            ))}
            {ownTasks.length === 0 && (
              <p className="rounded-app border border-dashed border-border py-6 text-center text-sm text-text-dim">
                Aucune tâche en attente.
              </p>
            )}
          </motion.div>
        </section>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, suffix = '', tone }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} suffix={suffix} />
      </p>
    </div>
  );
}
