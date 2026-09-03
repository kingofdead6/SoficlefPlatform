import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { surveysApi } from '../../../api/surveys.js';
import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, rowVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { INDICATOR_LABELS } from './HrSurveysPage.jsx';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const PERIODS = [
  { value: '', key: 'all' },
  { value: '30', key: '30' },
  { value: '90', key: '90' },
  { value: '180', key: '180' },
];

/**
 * /app/hr/surveys/results (route guide §2.3, SITE).
 * "Scores per indicator; filters by division/manager/period; individual responses."
 *
 * Division and manager filter server-side (GET /surveys/results?unitCode=&managerId=), inside
 * the caller's own survey scope — narrowing the Prisma query rather than hiding rows after the
 * fact. The period filter is applied here, on `answeredAt`, because the aggregate the server
 * returns is computed over the same set and re-deriving it per period would mean a second
 * definition of the score; the visible response count makes the effect explicit.
 */
export default function HrSurveyResultsPage() {
  const { t, i18n } = useTranslation();
  const [results, setResults] = useState(null);
  const [facets, setFacets] = useState({ units: [], managers: [] });
  const [filters, setFilters] = useState({ unitCode: '', managerId: '', period: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [openRoundId, setOpenRoundId] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usersApi.facets();
        setFacets(data);
      } catch {
        // Facets are a convenience; the page still works without the select options.
      }
    })();
  }, []);

  const load = useCallback(async (active) => {
    setRefreshing(true);
    try {
      const { data } = await surveysApi.results({
        unitCode: active.unitCode,
        managerId: active.managerId,
      });
      setResults(data);
      setError(null);
    } catch {
      setError(t('hr.surveyResults.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  // Only the server-side filters re-query; `period` is applied to the returned rows below.
  useEffect(() => {
    load({ unitCode: filters.unitCode, managerId: filters.managerId });
  }, [filters.unitCode, filters.managerId, load]);

  const responses = useMemo(() => {
    const all = results?.responses ?? [];
    if (!filters.period) return all;
    const cutoff = Date.now() - Number(filters.period) * 86_400_000;
    return all.filter((response) => new Date(response.answeredAt).getTime() >= cutoff);
  }, [results, filters.period]);

  if (loading) return <PageLoading label={t('hr.surveyResults.loading')} />;
  if (error) return <PageError message={error} />;

  const aggregate = results?.filtered ?? results?.overall;
  const filtersActive = Boolean(filters.unitCode || filters.managerId || filters.period);

  return (
    <div>
      <Link to="/app/hr/surveys" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        {t('hr.surveyResults.back')}
      </Link>

      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.surveyResults.title')}
        subtitle={t('hr.surveyResults.subtitle')}
      />

      <div className={`${CARD} mb-6 flex flex-wrap items-center gap-3 p-4`}>
        <select
          value={filters.unitCode}
          onChange={(e) => setFilters((f) => ({ ...f, unitCode: e.target.value }))}
          className={fieldClass}
        >
          <option value="">{t('hr.surveyResults.allStructures')}</option>
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
          <option value="">{t('hr.surveyResults.allManagers')}</option>
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
              {t(`hr.surveyResults.periods.${period.key}`)}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={() => setFilters({ unitCode: '', managerId: '', period: '' })}
            className="text-sm text-red-brand hover:underline"
          >
            {t('hr.surveyResults.reset')}
          </button>
        )}
        <span className="ml-auto text-sm text-text-dim">
          {t('hr.surveyResults.responseCount', { count: responses.length })}
        </span>
      </div>

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className={`mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveyResults.metrics.overall')}
          </p>
          {aggregate?.score === null || aggregate?.score === undefined ? (
            <p className="font-display text-3xl text-text-dim">—</p>
          ) : (
            <p className="font-display text-3xl text-red-deep">
              <CountUp value={aggregate.score} suffix="%" />
            </p>
          )}
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveyResults.metrics.responseRate')}
          </p>
          {aggregate?.responseRate === null || aggregate?.responseRate === undefined ? (
            <p className="font-display text-3xl text-text-dim">—</p>
          ) : (
            <p className="font-display text-3xl text-red-deep">
              <CountUp value={aggregate.responseRate} suffix="%" />
            </p>
          )}
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveyResults.metrics.issued')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={aggregate?.roundsIssued ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveyResults.metrics.answered')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={aggregate?.roundsAnswered ?? 0} />
          </p>
        </motion.div>
      </motion.div>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl text-text">{t('hr.surveyResults.byIndicator')}</h2>
        <div className={`overflow-hidden ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.indicator')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.average')}</th>
                <th className="w-1/2 px-4 py-3 font-medium">{t('hr.surveys.table.score')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.responses')}</th>
              </tr>
            </thead>
            <tbody>
              {(aggregate?.indicators ?? []).map((indicator) => (
                <tr key={indicator.indicator} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">
                    {INDICATOR_LABELS[indicator.indicator]
                      ? t(`hr.surveys.indicators.${INDICATOR_LABELS[indicator.indicator]}`)
                      : indicator.indicator}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">
                    {indicator.average === null ? '—' : indicator.average}
                  </td>
                  <td className="px-4 py-3">
                    {indicator.percent === null ? (
                      <span className="text-text-dim">{t('hr.surveyResults.notMeasurable')}</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${indicator.percent}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className={
                              indicator.percent < 50 ? 'h-full bg-status-red' : 'h-full bg-red-brand'
                            }
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-xs text-text-dim">
                          {indicator.percent}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">{indicator.responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl text-text">{t('hr.surveyResults.byMilestone')}</h2>
        <motion.div
          variants={staggerContainer(0.06)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-4 sm:grid-cols-4"
        >
          {(results?.byMilestone ?? []).map((milestone) => (
            <motion.div key={milestone.dayOffset} variants={staggerItem} className={`${CARD} p-5`}>
              <p className="mb-2 font-mono text-xs text-red-brand">J+{milestone.dayOffset}</p>
              {milestone.score === null ? (
                <p className="font-display text-3xl text-text-dim">—</p>
              ) : (
                <p className="font-display text-3xl text-red-deep">
                  <CountUp value={milestone.score} suffix="%" />
                </p>
              )}
              <p className="mt-1 text-xs text-text-dim">
                {t('hr.surveyResults.responsePair', { answered: milestone.answered, issued: milestone.issued ?? 0 })}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl text-text">{t('hr.surveyResults.individual')}</h2>
        {responses.length === 0 ? (
          <EmptyState
            title={t('hr.surveyResults.emptyTitle')}
            detail={
              filtersActive
                ? t('hr.surveyResults.emptyFiltered')
                : t('hr.surveyResults.emptyScope')
            }
            muted
          />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.employee')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.milestone')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.structure')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.manager')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.score')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.surveyResults.table.answeredAt')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer(0.03, 0.15)}
                initial={initialOrNone(reduce)}
                animate="visible"
              >
                {responses.map((response) => (
                  <Fragment key={response.roundId}>
                    <motion.tr
                      variants={rowVariants}
                      className="border-b border-border hover:bg-surface-2/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/hr/employees/${response.userId}`}
                          className="font-medium text-text hover:text-red-brand"
                        >
                          {response.displayName}
                        </Link>
                        <p className="text-xs text-text-dim">{response.positionFr ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-red-brand">
                        J+{response.dayOffset}
                      </td>
                      <td className="px-4 py-3 text-text-dim">{response.unitCode ?? '—'}</td>
                      <td className="px-4 py-3 text-text-dim">{response.managerName ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-dim">
                        {response.score === null ? '—' : `${response.score}%`}
                      </td>
                      <td className="px-4 py-3 text-text-dim">
                        {new Date(response.answeredAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenRoundId((current) =>
                              current === response.roundId ? null : response.roundId,
                            )
                          }
                          aria-expanded={openRoundId === response.roundId}
                          className="text-xs text-red-brand hover:underline"
                        >
                          {openRoundId === response.roundId ? t('hr.surveyResults.hide') : t('hr.surveyResults.detail')}
                        </button>
                      </td>
                    </motion.tr>
                    <AnimatePresence initial={false}>
                      {openRoundId === response.roundId && (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-border bg-surface-2/40"
                        >
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-2 sm:grid-cols-5">
                              {response.scores.map((entry) => (
                                <div key={entry.indicator}>
                                  <p className="text-[10px] uppercase tracking-wide text-text-dim">
                                    {INDICATOR_LABELS[entry.indicator]
                                      ? t(`hr.surveys.indicators.${INDICATOR_LABELS[entry.indicator]}`)
                                      : entry.indicator}
                                  </p>
                                  <p className="font-display text-lg text-red-deep">
                                    {entry.score}/5
                                  </p>
                                </div>
                              ))}
                            </div>
                            {response.commentFr && (
                              <p className="mt-3 border-t border-border pt-3 text-sm italic text-text-muted">
                                « {response.commentFr} »
                              </p>
                            )}
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
