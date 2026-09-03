import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { alertsApi } from '../../../api/alerts.js';
import { surveysApi } from '../../../api/surveys.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

export const INDICATOR_LABELS = {
  WELCOME_QUALITY: 'welcomeQuality',
  SUPPORT_LEVEL: 'supportLevel',
  ROLE_CLARITY: 'roleClarity',
  MANAGER_RELATIONSHIP: 'managerRelationship',
  WORKING_CONDITIONS: 'workingConditions',
};

const MILESTONE_DESCRIPTIONS = {
  7: 'firstWeek',
  30: 'firstMonth',
  60: 'secondMonth',
  90: 'trialEnd',
};

/**
 * /app/hr/surveys (route guide §2.3, SITE).
 * "Configure questionnaires and milestones (D+07/30/60/90), reminder rules."
 *
 * An honest configuration page rather than a pretend one. Two of the three things the spec
 * lists are *fixed by the domain*, not settings:
 *  - the milestones are SURVEY_MILESTONES = [7, 30, 60, 90] in domain/survey/satisfaction.js,
 *    generated for every journey by ensureRoundsFor at assignment time;
 *  - the questionnaire is the five SurveyIndicator enum values, which are database enum
 *    members — adding a sixth is a migration, not a form.
 * Both are therefore *shown* with their live state (how many rounds each milestone has
 * issued and answered, how each indicator is scoring) rather than presented as editable
 * fields that would silently do nothing.
 *
 * The third — reminder rules — is genuinely configurable, and lives on /app/hr/alerts against
 * the AlertRule table. The rules that concern surveys are surfaced here so the page answers
 * "when is somebody chased about an unanswered survey?" without a detour.
 */
export default function HrSurveysPage() {
  const { t } = useTranslation();
  const [satisfaction, setSatisfaction] = useState(null);
  const [results, setResults] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [satisfactionRes, resultsRes, rulesRes] = await Promise.all([
          surveysApi.satisfaction(),
          surveysApi.results(),
          alertsApi.rules().catch(() => ({ data: [] })),
        ]);
        setSatisfaction(satisfactionRes.data);
        setResults(resultsRes.data);
        setRules(rulesRes.data ?? []);
      } catch {
        setError(t('hr.surveys.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const surveyRules = useMemo(
    () => rules.filter((rule) => rule.trigger === 'SURVEY_UNANSWERED'),
    [rules],
  );

  if (loading) return <PageLoading label={t('hr.surveys.loading')} />;
  if (error) return <PageError message={error} />;

  const milestones = results?.byMilestone ?? satisfaction?.byMilestone ?? [];
  const indicators = satisfaction?.indicators ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.surveys.title')}
        subtitle={t('hr.surveys.subtitle')}
        actions={
          <>
            <Link
              to="/app/hr/alerts"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('hr.surveys.reminderRules')}
            </Link>
            <Link
              to="/app/hr/surveys/results"
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('hr.surveys.viewResults')}
            </Link>
          </>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveys.stats.issued')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={satisfaction?.roundsIssued ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveys.stats.answered')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={satisfaction?.roundsAnswered ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveys.stats.overdue')}
          </p>
          <p
            className={`font-display text-3xl ${
              (satisfaction?.roundsOverdue ?? 0) > 0 ? 'text-status-red' : 'text-red-deep'
            }`}
          >
            <CountUp value={satisfaction?.roundsOverdue ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.surveys.stats.responseRate')}
          </p>
          {satisfaction?.responseRate === null || satisfaction?.responseRate === undefined ? (
            <p className="font-display text-3xl text-text-dim">—</p>
          ) : (
            <p className="font-display text-3xl text-red-deep">
              <CountUp value={satisfaction.responseRate} suffix="%" />
            </p>
          )}
        </motion.div>
      </motion.div>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <h2 className="font-display text-xl text-text">{t('hr.surveys.milestones.title')}</h2>
        <p className="mb-4 text-sm text-text-dim">
          {t('hr.surveys.milestones.detail')}
        </p>
        <motion.div
          variants={staggerContainer(0.06)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {milestones.map((milestone) => (
            <motion.div key={milestone.dayOffset} variants={staggerItem} className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-red-brand/10 px-2 py-0.5 font-mono text-xs font-medium text-red-brand">
                  J+{milestone.dayOffset}
                </span>
                <span className="text-xs text-text-dim">
                  {t('hr.surveys.responses', { answered: milestone.answered, issued: milestone.issued })}
                </span>
              </div>
              <p className="mb-3 text-xs text-text-dim">
                {MILESTONE_DESCRIPTIONS[milestone.dayOffset]
                  ? t(`hr.surveys.milestones.${MILESTONE_DESCRIPTIONS[milestone.dayOffset]}`)
                  : ''}
              </p>
              <div className="flex items-center gap-3">
                <ProgressRing percent={milestone.score ?? 0} label={milestone.score === null ? '—' : undefined} />
                <span className="text-xs text-text-dim">{t('hr.surveys.score')}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.06 }}
        className="mb-10"
      >
        <h2 className="font-display text-xl text-text">{t('hr.surveys.questionnaire.title')}</h2>
        <p className="mb-4 text-sm text-text-dim">
          {t('hr.surveys.questionnaire.detail')}
        </p>
        <div className={`overflow-hidden ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.indicator')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.average')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.score')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.surveys.table.responses')}</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
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
                      <span className="text-text-dim">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${indicator.percent}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-red-brand"
                          />
                        </div>
                        <span className="font-mono text-xs text-text-dim">{indicator.percent}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">{indicator.responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.12 }}
      >
        <h2 className="font-display text-xl text-text">{t('hr.surveys.rules.title')}</h2>
        <p className="mb-4 text-sm text-text-dim">
          {t('hr.surveys.rules.detail')}
        </p>
        {surveyRules.length === 0 ? (
          <EmptyState
            title={t('hr.surveys.rules.emptyTitle')}
            detail={t('hr.surveys.rules.emptyDetail')}
            muted
          />
        ) : (
          <motion.div
            variants={staggerContainer(0.05)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid gap-3 sm:grid-cols-2"
          >
            {surveyRules.map((rule) => (
              <motion.div key={rule.id} variants={staggerItem} className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-text">{rule.labelFr}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.isActive
                        ? 'bg-status-green/10 text-status-green'
                        : 'bg-surface-2 text-text-dim'
                    }`}
                  >
                    {rule.isActive ? t('hr.surveys.active') : t('hr.surveys.inactive')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-dim">
                  {t('hr.surveys.ruleSummary', { threshold: rule.thresholdDays, department: rule.notifyDepartment })}
                  {rule.escalateAfterDays
                    ? ` ${t('hr.surveys.escalation', { days: rule.escalateAfterDays })}`
                    : ` ${t('hr.surveys.noEscalation')}`}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
