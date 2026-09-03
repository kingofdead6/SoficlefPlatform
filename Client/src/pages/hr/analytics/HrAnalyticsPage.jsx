import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { dashboardApi } from '../../../api/dashboard.js';
import { surveysApi } from '../../../api/surveys.js';
import { trainingApi } from '../../../api/training.js';
import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const PERIODS = [
  { value: '30', key: '30' },
  { value: '90', key: '90' },
  { value: '180', key: '180' },
  { value: '365', key: '365' },
];

/**
 * /app/hr/analytics (route guide §2.3, CORE).
 * "All Module 10 indicators; filters by division and manager; period comparison; 6-month
 * turnover."
 *
 * The Module 10 indicators come from GET /dashboard's `hr` block, which is exactly
 * domain/hr/indicators.js — completion rate, average onboarding days, confirmation rate,
 * six-month turnover, satisfaction and training coverage — already scoped per caller.
 * Those functions return **null rather than 0** when a figure is not measurable, and this
 * page honours that: an em dash means "nothing to measure", which is not the same claim as
 * "zero percent".
 *
 * Division/manager filters and the period comparison are computed from the scoped directory
 * (GET /users?view=directory), which is the only endpoint that carries per-person hire dates
 * and structure. The dashboard KPI block has no filter parameters, so the headline indicators
 * are the full-perimeter figures and the page says so where the two views sit side by side,
 * rather than implying the filters moved a number they did not.
 */
export default function HrAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [kpis, setKpis] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [facets, setFacets] = useState({ units: [], managers: [] });
  const [filters, setFilters] = useState({ unitCode: '', managerId: '', period: '90' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [kpisRes, satisfactionRes, coverageRes, facetsRes] = await Promise.all([
          dashboardApi.kpis(),
          surveysApi.satisfaction().catch(() => ({ data: null })),
          trainingApi.coverage().catch(() => ({ data: null })),
          usersApi.facets().catch(() => ({ data: { units: [], managers: [] } })),
        ]);
        setKpis(kpisRes.data);
        setSatisfaction(satisfactionRes.data);
        setCoverage(coverageRes.data);
        setFacets(facetsRes.data);
      } catch {
        setError(t('hr.analytics.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const loadDirectory = useCallback(async (active) => {
    setRefreshing(true);
    try {
      const query = {};
      if (active.unitCode) query.unitCode = active.unitCode;
      if (active.managerId) query.managerId = active.managerId;
      const { data } = await usersApi.directory(query);
      setDirectory(data);
    } catch {
      setDirectory([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory({ unitCode: filters.unitCode, managerId: filters.managerId });
  }, [filters.unitCode, filters.managerId, loadDirectory]);

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
    [loading, kpis],
  );

  if (loading) return <PageLoading label={t('hr.pages.analytics.loading')} />;
  if (error) return <PageError message={error} />;

  const hr = kpis?.hr;
  const onboarding = kpis?.onboarding;
  const days = Number(filters.period);

  /*
   * Period comparison: hires in the current window against the window immediately before it,
   * from the same filtered directory. Two equal-length windows is the only comparison the
   * data supports honestly — a month-over-month on a rolling window would compare unequal
   * spans.
   */
  const now = Date.now();
  const currentStart = now - days * 86_400_000;
  const previousStart = now - 2 * days * 86_400_000;

  const hires = directory.filter((row) => row.hireDate);
  const currentHires = hires.filter((row) => new Date(row.hireDate).getTime() >= currentStart).length;
  const previousHires = hires.filter((row) => {
    const time = new Date(row.hireDate).getTime();
    return time >= previousStart && time < currentStart;
  }).length;
  const delta = currentHires - previousHires;

  const filteredInProgress = directory.filter(
    (row) => row.onboardingPercent !== null && row.onboardingPercent < 100,
  ).length;
  const filteredCompleted = directory.filter((row) => row.onboardingPercent === 100).length;
  const filteredAverage =
    directory.filter((row) => row.onboardingPercent !== null).length === 0
      ? null
      : Math.round(
          directory
            .filter((row) => row.onboardingPercent !== null)
            .reduce((sum, row) => sum + row.onboardingPercent, 0) /
            directory.filter((row) => row.onboardingPercent !== null).length,
        );

  const filtersActive = Boolean(filters.unitCode || filters.managerId);

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.pages.analytics.title')}
        subtitle={t('hr.pages.analytics.subtitle')}
        actions={
          <Link
            to="/app/hr/analytics/reports"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('hr.analytics.reportLink')}
          </Link>
        }
      />

      {!hr ? (
        <EmptyState
          title={t('hr.analytics.emptyTitle')}
          detail={t('hr.analytics.emptyDetail')}
        />
      ) : (
        <>
          {/* Band 1 — the Module 10 indicators, full perimeter */}
          <div data-gsap="band" className="mb-4">
            <h2 className="mb-3 font-display text-xl text-text">{t('hr.analytics.moduleTitle')}</h2>
            <motion.div
              variants={staggerContainer(0.06)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            >
              <StatCard label={t('hr.analytics.metrics.completion')} value={hr.completionRate} suffix="%" />
              <StatCard label={t('hr.analytics.metrics.duration')} value={hr.averageOnboardingDays} suffix={` ${t('hr.analytics.dayShort')}`} />
              <StatCard label={t('hr.analytics.metrics.confirmation')} value={hr.confirmationRate} suffix="%" />
              <StatCard
                label={i18n.language === 'en' ? 'Six-month turnover' : 'Turnover 6 mois'}
                value={hr.turnoverRate}
                suffix="%"
                tone={hr.turnoverRate !== null && hr.turnoverRate > 15 ? 'red' : undefined}
                footnote={
                  hr.turnoverCohort === 0
                    ? t('hr.analytics.metrics.noCohort')
                    : t('hr.analytics.metrics.cohort', { count: hr.turnoverCohort })
                }
              />
              <StatCard label={t('hr.analytics.metrics.satisfaction')} value={hr.satisfaction} suffix="%" />
              <StatCard label={t('hr.analytics.metrics.training')} value={hr.trainingRate} suffix="%" />
            </motion.div>
            <p className="mt-3 text-xs text-text-dim">
              {t('hr.analytics.moduleNote')}
            </p>
          </div>

          {/* Band 2 — filters + period comparison */}
          <div data-gsap="band" className="mb-10 mt-8">
            <h2 className="mb-3 font-display text-xl text-text">{t('hr.analytics.filteredTitle')}</h2>

            <div className={`${CARD} mb-4 flex flex-wrap items-center gap-3 p-4`}>
              <select
                value={filters.unitCode}
                onChange={(e) => setFilters((f) => ({ ...f, unitCode: e.target.value }))}
                className={fieldClass}
              >
                <option value="">{t('hr.analytics.allStructures')}</option>
                {facets.units.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.code} — {unit.nameFr}
                  </option>
                ))}
              </select>
              <select
                value={filters.managerId}
                onChange={(e) => setFilters((f) => ({ ...f, managerId: e.target.value }))}
                className={fieldClass}
              >
                <option value="">{t('hr.analytics.allManagers')}</option>
                {facets.managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.displayName}
                  </option>
                ))}
              </select>
              <select
                value={filters.period}
                onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
                className={fieldClass}
              >
                {PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {t('hr.analytics.period', { period: t(`hr.analytics.periods.${period.key}`) })}
                  </option>
                ))}
              </select>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, unitCode: '', managerId: '' }))}
                  className="text-sm text-red-brand hover:underline"
                >
                  {t('hr.analytics.reset')}
                </button>
              )}
              <span className="ml-auto text-sm text-text-dim">
                {t('hr.analytics.peopleCount', { count: directory.length })}
              </span>
            </div>

            <motion.div
              variants={staggerContainer(0.06)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}
            >
              <motion.div variants={staggerItem} className={`${CARD} p-5`}>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  {t('hr.analytics.hires', { period: t(`hr.analytics.periods.${filters.period}`) })}
                </p>
                <p className="font-display text-3xl text-red-deep">
                  <CountUp value={currentHires} />
                </p>
                <p
                  className={`mt-1 text-xs ${
                    delta > 0 ? 'text-status-green' : delta < 0 ? 'text-status-red' : 'text-text-dim'
                  }`}
                >
                  {delta === 0
                    ? t('hr.analytics.stable', { days, count: previousHires })
                    : t('hr.analytics.delta', { delta: `${delta > 0 ? '+' : ''}${delta}`, count: previousHires })}
                </p>
              </motion.div>

              <motion.div variants={staggerItem} className={`${CARD} p-5`}>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  {t('hr.analytics.filteredInProgress')}
                </p>
                <p className="font-display text-3xl text-red-deep">
                  <CountUp value={filteredInProgress} />
                </p>
              </motion.div>

              <motion.div variants={staggerItem} className={`${CARD} p-5`}>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  {t('hr.analytics.filteredCompleted')}
                </p>
                <p className="font-display text-3xl text-red-deep">
                  <CountUp value={filteredCompleted} />
                </p>
              </motion.div>

              <motion.div variants={staggerItem} className={`${CARD} flex items-center gap-4 p-5`}>
                <ProgressRing
                  percent={filteredAverage ?? 0}
                  label={filteredAverage === null ? '—' : undefined}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                    {t('hr.analytics.averageProgress')}
                  </p>
                  <p className="text-xs text-text-dim">{t('hr.analytics.filteredScope')}</p>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Band 3 — supporting detail */}
          <div data-gsap="band" className="grid gap-8 lg:grid-cols-3">
            <section>
              <h2 className="mb-3 font-display text-lg text-text">{t('hr.analytics.journeyHealth')}</h2>
              <div className={`${CARD} space-y-3 p-5 text-sm`}>
                <Row label={t('hr.analytics.activeJourneys')} value={onboarding?.journeys ?? 0} />
                <Row
                  label={t('hr.analytics.overdueSteps')}
                  value={onboarding?.overdueTasks ?? 0}
                  tone={(onboarding?.overdueTasks ?? 0) > 0 ? 'red' : undefined}
                />
                <Row
                  label={t('hr.analytics.blockedSteps')}
                  value={onboarding?.blockedTasks ?? 0}
                  tone={(onboarding?.blockedTasks ?? 0) > 0 ? 'red' : undefined}
                />
                <Row label={t('hr.analytics.averageProgress')} value={`${onboarding?.averagePercent ?? 0}%`} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg text-text">{t('hr.analytics.satisfactionByMilestone')}</h2>
              <div className={`${CARD} space-y-3 p-5 text-sm`}>
                {(satisfaction?.byMilestone ?? []).map((milestone) => (
                  <Row
                    key={milestone.dayOffset}
                    label={`J+${milestone.dayOffset}`}
                    value={milestone.score === null ? '—' : `${milestone.score}%`}
                  />
                ))}
                {(satisfaction?.byMilestone ?? []).length === 0 && (
                  <p className="text-text-dim">{t('hr.analytics.noSurveys')}</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg text-text">{t('hr.analytics.dataQuality')}</h2>
              <div className={`${CARD} space-y-3 p-5 text-sm`}>
                <Row
                  label={t('hr.analytics.unitsWithoutHead')}
                  value={kpis?.quality?.unitsWithoutHead ?? '—'}
                  tone={(kpis?.quality?.unitsWithoutHead ?? 0) > 0 ? 'red' : undefined}
                />
                <Row
                  label={t('hr.analytics.jobsWithoutDescription')}
                  value={kpis?.quality?.jobsWithoutDescription ?? '—'}
                  tone={(kpis?.quality?.jobsWithoutDescription ?? 0) > 0 ? 'red' : undefined}
                />
                <Row
                  label={t('hr.analytics.descriptionCoverage')}
                  value={
                    kpis?.jobDescriptions ? `${kpis.jobDescriptions.coverage}%` : '—'
                  }
                />
                <Row
                  label={t('hr.analytics.trainedEmployees')}
                  value={coverage ? `${coverage.fullyTrained}/${coverage.people}` : '—'}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix = '', tone, footnote }) {
  const measurable = value !== null && value !== undefined;
  return (
    <motion.div variants={staggerItem} initial="rest" whileHover="hover">
      <motion.div variants={cardHover} className={`${CARD} h-full p-5`}>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
        <p
          className={`font-display text-3xl ${
            !measurable ? 'text-text-dim' : tone === 'red' ? 'text-status-red' : 'text-red-deep'
          }`}
        >
          {measurable ? <CountUp value={value} suffix={suffix} /> : '—'}
        </p>
        {footnote && <p className="mt-1 text-xs text-text-dim">{footnote}</p>}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-text-dim">{label}</span>
      <span className={`font-mono ${tone === 'red' ? 'text-status-red' : 'text-text'}`}>{value}</span>
    </div>
  );
}
