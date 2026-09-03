import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../api/onboarding.js';
import PageHeader from '../../components/manager/PageHeader.jsx';
import ProgressRing from '../../components/manager/ProgressRing.jsx';
import CountUp from '../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../lib/motion/variants.js';
import { localeOf } from '../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-xl text-text';

/**
 * The three phases the route guide names, plus the terminal one the API also returns.
 * Each carries the sentence that says what the phase *means*, because "PROBATION" on its
 * own tells a new arrival nothing about what is expected of them this week.
 */
const PHASE_IDS = ['PRE_ONBOARDING', 'DAY_ONE', 'PROBATION', 'COMPLETED'];

/**
 * /app/me — Dashboard (route guide §2.1, CORE).
 * "Progress ring (% path completed), next 3 tasks with deadlines, countdown to D-Day,
 * current phase badge (pre-onboarding / day one / probation), quick links to manager and
 * HR contact."
 *
 * Backed entirely by GET /onboarding/me/overview, which already computes the phase, the day
 * number and the next three tasks server-side — this page does no filtering of its own, so
 * "the next three tasks" means the same thing here as it does to the manager portal.
 *
 * Motion follows ManagerDashboardPage: GSAP orchestrates the load-in of the page's bands,
 * anime.js drives the ring and the count-ups, Framer handles list stagger and card hover.
 */
export default function MeDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t, i18n } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.meOverview();
        setData(data);
      } catch {
        setError('load');
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

  /**
   * The countdown. `dayNumber` is negative before the start date, 0 on it, positive after —
   * so the same field answers both "how long until I start" and "how long have I been here",
   * and the wording has to change with the sign or it reads as a mistake. Each form is its
   * own key rather than a prefix plus a number: English says "D-3" and "Day one", which no
   * single concatenation produces.
   */
  const countdown = useMemo(() => {
    if (!data || data.dayNumber === null) return null;
    const n = data.dayNumber;
    if (n < 0) {
      const days = Math.abs(n);
      return {
        badge: t('me.dashboard.countdown.beforeBadge', { count: days }),
        detail: t('me.dashboard.countdown.beforeDetail', { count: days }),
      };
    }
    if (n === 0) {
      return {
        badge: t('me.dashboard.countdown.dayOneBadge'),
        detail: t('me.dashboard.countdown.dayOneDetail'),
      };
    }
    return {
      badge: t('me.dashboard.countdown.afterBadge', { count: n }),
      detail: t('me.dashboard.countdown.afterDetail', { count: n }),
    };
  }, [data, t]);

  if (loading) return <PageLoading label={t('me.dashboard.loading')} />;
  if (error) return <PageError message={t('me.dashboard.loadFailed')} />;

  const phase = PHASE_IDS.includes(data.phase)
    ? {
        label: t(`me.dashboard.phases.${data.phase}.label`),
        detail: t(`me.dashboard.phases.${data.phase}.detail`),
      }
    : { label: data.phase, detail: '' };
  const ringTone = data.overdueCount > 0 ? 'red' : data.progress.percent >= 100 ? 'green' : 'brand';

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.dashboard.greeting', { name: data.displayName })}
        subtitle={
          data.position?.titleFr
            ? t('me.dashboard.subtitleWithPosition', {
                position: data.position.titleFr,
                detail: phase.detail,
              })
            : t('me.dashboard.subtitleUnassigned', { detail: phase.detail })
        }
        actions={
          <>
            <Link
              to="/app/me/journey"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('me.dashboard.myJourney')}
            </Link>
            <Link
              to="/app/me/assistant"
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('me.dashboard.askQuestion')}
            </Link>
          </>
        }
      />

      {/* Band 1 — where I am: phase, countdown, and the figures behind them. */}
      <div data-gsap="band" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('me.dashboard.phaseLabel')}
          </p>
          <p className="font-display text-2xl leading-tight text-red-deep">{phase.label}</p>
          <p className="mt-1 text-xs text-text-dim">{phase.detail}</p>
        </div>

        <div className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('me.dashboard.countdown.label')}
          </p>
          {countdown ? (
            <>
              <p className="font-display text-3xl text-red-deep">{countdown.badge}</p>
              <p className="mt-1 text-xs text-text-dim">{countdown.detail}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-dim">{t('me.dashboard.countdown.none')}</p>
          )}
        </div>

        <SummaryTile
          label={t('me.dashboard.openSurveys')}
          value={data.openSurveys}
          tone={data.openSurveys > 0 ? 'red' : undefined}
          href="/app/me/surveys"
        />
        <SummaryTile
          label={t('me.dashboard.trainingOutstanding')}
          value={data.trainingOutstanding}
          tone={data.trainingOutstanding > 0 ? 'red' : undefined}
          href="/app/me/training"
        />
      </div>

      {/* Band 2 — the ring, the next three tasks, and who to ask. */}
      <div data-gsap="band" className="grid flex-1 gap-8 lg:grid-cols-3">
        <section className={`flex flex-col items-center justify-center ${CARD} p-8`}>
          <ProgressRing percent={data.progress.percent} tone={ringTone} />
          <p className="mt-4 text-center text-sm text-text-dim">
            {t('me.dashboard.progress.done', {
              count: data.progress.total,
              done: data.progress.done,
              total: data.progress.total,
            })}
          </p>
          {data.overdueCount > 0 && (
            <p className="mt-1 text-center text-xs font-medium text-status-red">
              {t('me.dashboard.progress.overdue', { count: data.overdueCount })}
            </p>
          )}
          <Link
            to="/app/me/journey"
            className="mt-5 rounded-app border border-border px-3 py-1.5 text-xs font-medium text-red-brand transition-colors hover:border-red-brand"
          >
            {t('me.dashboard.progress.seeFullJourney')}
          </Link>
        </section>

        <section className="flex flex-col lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>{t('me.dashboard.nextTasks.title')}</h2>
            <span className="text-sm text-text-dim">{data.nextTasks.length}</span>
          </div>

          <motion.div
            variants={staggerContainer(0.07, 0.3)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="flex-1 space-y-2"
          >
            {data.nextTasks.map((task) => (
              <motion.div
                key={task.milestoneId}
                variants={staggerItem}
                whileHover={reduce ? undefined : { y: -3, boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={`/app/me/journey/${task.milestoneId}`}
                  className={`block ${CARD} p-4 transition-colors hover:border-red-brand`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-text">{task.titleFr}</span>
                    {task.dueDate && (
                      <span
                        className={`shrink-0 text-xs ${task.overdue ? 'font-medium text-status-red' : 'text-text-dim'}`}
                      >
                        {task.overdue ? `${t('me.dashboard.nextTasks.overdue')} · ` : ''}
                        {new Date(task.dueDate).toLocaleDateString(localeOf(i18n))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-dim">
                    {task.dayLabelFr}
                    {task.detailFr ? ` — ${task.detailFr}` : ''}
                  </p>
                </Link>
              </motion.div>
            ))}
            {data.nextTasks.length === 0 && (
              <EmptyState
                title={t('me.dashboard.nextTasks.emptyTitle')}
                detail={t('me.dashboard.nextTasks.emptyDetail')}
                muted
              />
            )}
          </motion.div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ContactCard
              label={t('me.dashboard.contacts.manager')}
              name={data.manager?.displayName}
              lines={[data.manager?.email, data.manager?.phone].filter(Boolean)}
              href="/app/me/team"
              hrefLabel={t('me.dashboard.contacts.seeTeam')}
            />
            <ContactCard
              label={t('me.dashboard.contacts.hr')}
              name={data.hrContact?.nameFr}
              lines={[
                data.hrContact?.roleFr,
                data.hrContact?.extension
                  ? t('me.dashboard.contacts.extension', { extension: data.hrContact.extension })
                  : null,
              ].filter(Boolean)}
              href="/app/me/team"
              hrefLabel={t('me.dashboard.contacts.allContacts')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone, href }) {
  const body = (
    <>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value ?? 0} />
      </p>
    </>
  );

  if (!href) return <div className={`${CARD} p-5`}>{body}</div>;

  return (
    <Link to={href} className={`block ${CARD} p-5 transition-colors hover:border-red-brand`}>
      {body}
    </Link>
  );
}

function ContactCard({ label, name, lines, href, hrefLabel }) {
  const { t } = useTranslation();

  return (
    <div className={`${CARD} p-4`}>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      {name ? (
        <>
          <p className="font-medium text-text">{name}</p>
          {lines.map((line) => (
            <p key={line} className="text-xs text-text-dim">
              {line}
            </p>
          ))}
        </>
      ) : (
        <p className="text-sm text-text-dim">{t('me.dashboard.contacts.none')}</p>
      )}
      <Link to={href} className="mt-2 inline-block text-xs font-medium text-red-brand hover:underline">
        {hrefLabel}
      </Link>
    </div>
  );
}
