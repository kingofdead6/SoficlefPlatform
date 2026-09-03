import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import { localeOf } from '../../../lib/formatDate.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const KIND_TONE = {
  evaluation: 'border-red-brand/30 bg-red-brand/5 text-red-deep',
  blocked: 'border-status-red/30 bg-status-red/5 text-status-red',
  overdue: 'border-status-red/30 bg-status-red/5 text-status-red',
};
const KIND_LABEL_KEYS = {
  evaluation: 'manager.calendar.kind.evaluation',
  blocked: 'manager.calendar.kind.blocked',
  overdue: 'manager.calendar.kind.overdue',
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupByDay(events) {
  const groups = new Map();
  for (const event of events) {
    const key = startOfDay(event.date).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return [...groups.entries()].sort(([a], [b]) => new Date(a) - new Date(b));
}

/**
 * /app/manager/calendar — additional manager page (not in the PDF route guide; added on
 * request). A date-grouped timeline of every recruit's evaluation due dates (D+30, D+90,
 * end of probation), built from onboardingApi.managerRecruits()'s per-recruit
 * `evaluationsDue` list — the same source domain/manager/alerts.js reads, but here every
 * upcoming date is shown rather than only the ones inside alertsFor's 7-day window.
 * Recruits with a blocked or overdue step (no fixed date to place on a calendar) are
 * listed separately below the dated timeline.
 */
export default function ManagerCalendarPage() {
  const { t, i18n } = useTranslation();
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.managerRecruits(false);
        setRecruits(data);
      } catch {
        setError(t('manager.calendar.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const events = useMemo(() => {
    const now = new Date();
    return recruits.flatMap((recruit) =>
      (recruit.evaluationsDue ?? []).map((evaluation) => ({
        id: evaluation.id,
        kind: 'evaluation',
        date: new Date(evaluation.dueDate),
        overdue: new Date(evaluation.dueDate) < now,
        displayName: recruit.displayName,
        milestone: evaluation.milestone,
        href: `/app/manager/evaluations/${evaluation.id}`,
      })),
    );
  }, [recruits]);

  const blockedOrOverdue = useMemo(
    () =>
      recruits
        .filter((recruit) => recruit.blocked > 0 || recruit.overdue > 0)
        .map((recruit) => ({
          userId: recruit.userId,
          displayName: recruit.displayName,
          blocked: recruit.blocked,
          overdue: recruit.overdue,
        })),
    [recruits],
  );

  const grouped = useMemo(() => groupByDay(events), [events]);

  if (loading) return <PageLoading label={t('manager.calendar.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('manager.calendar.title')}
        subtitle={t('manager.calendar.subtitle')}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <motion.div
          variants={staggerContainer(0.07)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="space-y-6 lg:col-span-2"
        >
          {grouped.map(([key, dayEvents]) => (
            <motion.div key={key} variants={staggerItem}>
              <p className="mb-2 font-display text-sm uppercase tracking-wide text-text-dim">
                {new Date(key).toLocaleDateString(localeOf(i18n), { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={event.href}
                    className={`block rounded-app border p-3 text-sm shadow-app transition hover:shadow-app-lifted ${
                      event.overdue ? KIND_TONE.overdue : KIND_TONE.evaluation
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {t('manager.calendar.eventTitle', {
                          name: event.displayName,
                          milestone: event.milestone,
                        })}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs">
                        {event.overdue ? t(KIND_LABEL_KEYS.overdue) : t(KIND_LABEL_KEYS.evaluation)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
          {grouped.length === 0 && <EmptyState detail={t('manager.calendar.noUpcoming')} />}
        </motion.div>

        <motion.div variants={staggerContainer(0.07)} initial={initialOrNone(reduce)} animate="visible">
          <h2 className="mb-3 font-display text-lg text-text">{t('manager.calendar.blockedOrOverdue')}</h2>
          <div className="space-y-2">
            {blockedOrOverdue.map((recruit) => (
              <motion.div key={recruit.userId} variants={staggerItem}>
                <Link
                  to={`/app/manager/recruits/${recruit.userId}`}
                  className={`block rounded-app border p-3 text-sm shadow-app transition hover:shadow-app-lifted ${KIND_TONE.blocked}`}
                >
                  <p className="font-medium">{recruit.displayName}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {recruit.blocked > 0 ? t('manager.blockedCount', { count: recruit.blocked }) : ''}
                    {recruit.blocked > 0 && recruit.overdue > 0 ? ' · ' : ''}
                    {recruit.overdue > 0 ? t('manager.overdueCount', { count: recruit.overdue }) : ''}
                  </p>
                </Link>
              </motion.div>
            ))}
            {blockedOrOverdue.length === 0 && <EmptyState detail={t('manager.calendar.nothingBlocked')} muted />}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
