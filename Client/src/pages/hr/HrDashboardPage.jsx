import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { dashboardApi } from '../../api/dashboard.js';
import { assignmentsApi } from '../../api/organization.js';
import { usersApi } from '../../api/users.js';
import { surveysApi } from '../../api/surveys.js';
import { onboardingApi } from '../../api/onboarding.js';
import PageHeader from '../../components/manager/PageHeader.jsx';
import ProgressRing from '../../components/manager/ProgressRing.jsx';
import CountUp from '../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem } from '../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-xl text-text';

const MONTH_MS = 30 * 86_400_000;

/**
 * /app/hr — the HR dashboard (route guide §2.3, CORE).
 * "Counters (recruitments this month, onboardings in progress/completed/late), completion
 * gauge, satisfaction score, alert feed, pending-assignments badge."
 *
 * Every figure is real: the counters come from the scoped directory + the dashboard KPI
 * block, the gauge and satisfaction score from GET /dashboard's `hr`/`onboarding` blocks,
 * and the alert feed is assembled from facts the API already returns (accounts waiting to
 * be placed, overdue and blocked tasks, unanswered surveys). Nothing here is simulated.
 *
 * Motion mirrors the manager dashboard exactly: GSAP orchestrates the band load-in,
 * anime.js drives the count-ups and the completion ring, Framer Motion the list stagger.
 */
export default function HrDashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [pending, setPending] = useState([]);
  const [requests, setRequests] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [probation, setProbation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [kpisRes, pendingRes, requestsRes, directoryRes, satisfactionRes] = await Promise.all([
          dashboardApi.kpis(),
          assignmentsApi.pendingAccounts(),
          assignmentsApi.accountRequests(50),
          usersApi.directory(),
          surveysApi.satisfaction(),
        ]);
        setKpis(kpisRes.data);
        setPending(pendingRes.data);
        setRequests(requestsRes.data);
        setDirectory(directoryRes.data);
        setSatisfaction(satisfactionRes.data);

        /*
         * The probation queue is fetched separately and tolerantly: it is one band of this
         * page, not its subject, and an empty queue is the normal state. A failure here
         * must not blank the whole dashboard.
         */
        onboardingApi
          .probationQueue()
          .then((res) => setProbation(res.data ?? []))
          .catch(() => setProbation([]));
      } catch {
        setError('Impossible de charger le tableau de bord RH.');
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
    [loading, kpis],
  );

  const counters = useMemo(() => {
    if (!kpis) return null;
    const cutoff = Date.now() - MONTH_MS;

    // "Recrutements ce mois" — people hired within the last 30 days, from the same scoped
    // directory the /app/hr/employees page reads.
    const hiredThisMonth = directory.filter(
      (row) => row.hireDate && new Date(row.hireDate).getTime() >= cutoff,
    ).length;

    const inProgress = directory.filter(
      (row) => row.onboardingPercent !== null && row.onboardingPercent < 100,
    ).length;
    const completed = directory.filter((row) => row.onboardingPercent === 100).length;

    return {
      hiredThisMonth,
      inProgress,
      completed,
      late: kpis.onboarding?.overdueTasks ?? 0,
      blocked: kpis.onboarding?.blockedTasks ?? 0,
      averagePercent: kpis.onboarding?.averagePercent ?? 0,
      completionRate: kpis.hr?.completionRate,
      satisfactionScore: satisfaction?.score ?? kpis.hr?.satisfaction ?? null,
    };
  }, [kpis, directory, satisfaction]);

  /**
   * The alert feed. Each entry is a fact already returned by an endpoint above — an account
   * left waiting, tasks past their date, surveys nobody answered — with a link to the page
   * where it can actually be acted on.
   */
  const alerts = useMemo(() => {
    const feed = [];

    const stale = pending.filter((account) => account.waitingDays >= 3);
    if (stale.length > 0) {
      feed.push({
        id: 'pending-accounts',
        severity: 'red',
        titleFr: `${stale.length} compte(s) en attente depuis plus de 3 jours`,
        detailFr: `Le plus ancien attend depuis ${Math.max(...stale.map((a) => a.waitingDays))} jours.`,
        href: '/app/hr/employees/unassigned',
      });
    }

    const openRequests = requests.filter((request) => request.status === 'OPEN');
    if (openRequests.length > 0) {
      feed.push({
        id: 'open-requests',
        severity: 'blue',
        titleFr: `${openRequests.length} demande(s) de compte ouverte(s) auprès du SI`,
        detailFr: openRequests.some((request) => request.urgency === 'URGENT')
          ? 'Dont au moins une marquée urgente.'
          : 'En attente de création par le SI.',
        href: '/app/hr/employees/request',
      });
    }

    if ((kpis?.onboarding?.overdueTasks ?? 0) > 0) {
      feed.push({
        id: 'overdue',
        severity: 'red',
        titleFr: `${kpis.onboarding.overdueTasks} étape(s) d'intégration en retard`,
        detailFr: 'Des étapes ont dépassé leur date prévue sur les parcours en cours.',
        href: '/app/hr/analytics',
      });
    }

    if ((kpis?.onboarding?.blockedTasks ?? 0) > 0) {
      feed.push({
        id: 'blocked',
        severity: 'red',
        titleFr: `${kpis.onboarding.blockedTasks} étape(s) bloquée(s)`,
        detailFr: 'Ces étapes ont été signalées comme bloquées par leur responsable.',
        href: '/app/hr/analytics',
      });
    }

    if ((satisfaction?.roundsOverdue ?? 0) > 0) {
      feed.push({
        id: 'surveys',
        severity: 'blue',
        titleFr: `${satisfaction.roundsOverdue} enquête(s) sans réponse`,
        detailFr: 'Des enquêtes de satisfaction ont dépassé leur échéance.',
        href: '/app/hr/surveys/results',
      });
    }

    if ((kpis?.quality?.jobsWithoutDescription ?? 0) > 0) {
      feed.push({
        id: 'jobs-without-description',
        severity: 'blue',
        titleFr: `${kpis.quality.jobsWithoutDescription} poste(s) sans fiche de poste`,
        detailFr: 'Ces postes existent dans l’organigramme mais n’ont pas de fiche.',
        href: '/app/hr/positions',
      });
    }

    return feed;
  }, [pending, requests, kpis, satisfaction]);

  if (loading) return <PageLoading label="Chargement du tableau de bord RH…" />;
  if (error) return <PageError message={error} />;

  const waitingQueue = [...pending].sort((a, b) => b.waitingDays - a.waitingDays).slice(0, 6);

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Ressources humaines"
        title="Tableau de bord"
        subtitle="Recrutements, intégrations en cours, satisfaction et alertes du périmètre RH."
        actions={
          <>
            <Link
              to="/app/hr/employees/request"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Demander un compte
            </Link>
            <Link
              to="/app/hr/employees/unassigned"
              className="relative rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              File d’affectation
              {pending.length > 0 && (
                <span className="ml-2 rounded-full bg-white/25 px-1.5 py-0.5 text-xs font-semibold">
                  {pending.length}
                </span>
              )}
            </Link>
          </>
        }
      />

      {/* Band 1 — the counters the spec names */}
      <div data-gsap="band" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Recrutements (30 j)" value={counters.hiredThisMonth} />
        <SummaryTile label="Intégrations en cours" value={counters.inProgress} />
        <SummaryTile label="Intégrations terminées" value={counters.completed} />
        <SummaryTile
          label="Étapes en retard"
          value={counters.late}
          tone={counters.late > 0 ? 'red' : undefined}
        />
      </div>

      {/*
        Band 1b — trial periods awaiting a decision (route guide §2.5).
        Rendered only when the queue is non-empty: an always-present "0 à valider" tile
        would be noise on a dashboard whose job is to surface what needs attention.
      */}
      {probation.length > 0 && (
        <div data-gsap="band" className="mb-10">
          <div className="rounded-app border border-border bg-surface p-5 shadow-app">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-text">
                  Périodes d’essai à valider
                  <span className="ml-2 rounded-full bg-red-brand/10 px-2 py-0.5 text-sm font-medium text-red-brand">
                    {probation.length}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-text-dim">
                  {probation.length === 1
                    ? 'Un responsable a transmis son évaluation. La décision vous revient.'
                    : 'Des responsables ont transmis leurs évaluations. Les décisions vous reviennent.'}
                </p>
              </div>
              <Link
                to="/app/hr/probation"
                className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
              >
                Ouvrir la file
              </Link>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {probation.slice(0, 6).map((entry) => (
                <li
                  key={entry.instanceId}
                  className="rounded-app border border-border px-3 py-1.5 text-xs text-text-dim"
                >
                  <span className="font-medium text-text">{entry.subject.displayName}</span>
                  <span className="ml-2 font-mono">{entry.scorePercent} %</span>
                </li>
              ))}
              {probation.length > 6 && (
                <li className="px-1 py-1.5 text-xs text-text-dim">
                  et {probation.length - 6} autre{probation.length - 6 > 1 ? 's' : ''}…
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Band 2 — gauge + satisfaction + alert feed */}
      <div data-gsap="band" className="mb-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className={`mb-4 ${SECTION_TITLE}`}>Avancement</h2>
          <div className={`${CARD} flex items-center gap-6 p-6`}>
            <ProgressRing
              percent={counters.averagePercent}
              tone={counters.late > 0 || counters.blocked > 0 ? 'red' : 'brand'}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                Progression moyenne
              </p>
              <p className="font-display text-2xl text-red-deep">
                <CountUp value={counters.averagePercent} suffix="%" />
              </p>
              <p className="mt-1 text-xs text-text-dim">
                {counters.completionRate === null || counters.completionRate === undefined
                  ? 'Taux de complétion non mesurable.'
                  : `Taux de complétion des parcours : ${counters.completionRate}%.`}
              </p>
            </div>
          </div>

          <div className={`${CARD} mt-4 p-6`}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
              Score de satisfaction
            </p>
            {counters.satisfactionScore === null ? (
              <p className="font-display text-3xl text-text-dim">—</p>
            ) : (
              <p className="font-display text-3xl text-red-deep">
                <CountUp value={counters.satisfactionScore} suffix="%" />
              </p>
            )}
            <p className="mt-1 text-xs text-text-dim">
              {satisfaction
                ? `${satisfaction.roundsAnswered}/${satisfaction.roundsIssued} enquêtes renseignées.`
                : 'Aucune enquête émise.'}
            </p>
            <Link
              to="/app/hr/surveys/results"
              className="mt-3 inline-block text-xs font-medium text-red-brand hover:underline"
            >
              Voir le détail des résultats →
            </Link>
          </div>
        </section>

        <section className="flex flex-col lg:col-span-2">
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
                  className={`block rounded-app border p-3 text-sm shadow-app transition hover:shadow-app-lifted ${
                    alert.severity === 'red'
                      ? 'border-status-red/40 bg-status-red/10 text-status-red'
                      : 'border-red-brand/40 bg-red-brand/10 text-red-deep'
                  }`}
                >
                  <p className="font-medium">{alert.titleFr}</p>
                  <p className="text-xs opacity-80">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
            {alerts.length === 0 && <EmptyState detail="Aucune alerte. Tout est à jour." muted />}
          </motion.div>
        </section>
      </div>

      {/* Band 3 — the affectation queue, oldest first */}
      <div data-gsap="band">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className={SECTION_TITLE}>Comptes en attente d’affectation</h2>
          <Link to="/app/hr/employees/unassigned" className="text-sm text-red-brand hover:underline">
            Tout voir
          </Link>
        </div>
        {waitingQueue.length === 0 ? (
          <EmptyState detail="Aucun compte en attente d’affectation." muted />
        ) : (
          <motion.div
            variants={staggerContainer(0.06, 0.3)}
            initial={reduce ? false : 'hidden'}
            animate="visible"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {waitingQueue.map((account) => (
              <motion.div key={account.id} variants={staggerItem}>
                <Link
                  to={`/app/hr/employees/${account.id}/assign`}
                  className={`block ${CARD} p-4 transition-colors hover:border-red-brand`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-text">{account.displayName}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.waitingDays >= 3
                          ? 'bg-status-red/10 text-status-red'
                          : 'bg-surface-2 text-text-dim'
                      }`}
                    >
                      {account.waitingDays} j
                    </span>
                  </div>
                  <p className="truncate text-xs text-text-dim">{account.email}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
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
