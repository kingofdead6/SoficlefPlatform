import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { dashboardApi } from '../../../api/dashboard.js';
import { surveysApi } from '../../../api/surveys.js';
import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * The report sections a caller can assemble. Each maps to data the platform genuinely has;
 * nothing here is generated prose.
 */
const SECTIONS = [
  { id: 'indicators' },
  { id: 'onboarding' },
  { id: 'satisfaction' },
  { id: 'directory' },
  { id: 'quality' },
];

/**
 * /app/hr/analytics/reports (route guide §2.3, LATER — "Agent 5 natural-language reporting").
 *
 * **The honest page.** No LLM provider is wired into this platform anywhere (ADR-003,
 * documented in server/src/domain/assistant/agents.js), so there is no natural-language
 * report generation to offer, and no chat box pretending otherwise is built here — the same
 * stance ManagerAssistantPage takes.
 *
 * What is real, and is what this page does: HR chooses which blocks of *existing, already
 * computed* figures to include and exports them as a CSV they can hand on. That is a report
 * builder in the only sense the platform can currently honour — assembling data it holds,
 * not writing prose about it.
 */
export default function HrReportBuilderPage() {
  const { t } = useTranslation();
  const [kpis, setKpis] = useState(null);
  const [satisfaction, setSatisfaction] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set(['indicators', 'onboarding', 'satisfaction']));
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [kpisRes, satisfactionRes, directoryRes] = await Promise.all([
          dashboardApi.kpis(),
          surveysApi.satisfaction().catch(() => ({ data: null })),
          usersApi.directory().catch(() => ({ data: [] })),
        ]);
        setKpis(kpisRes.data);
        setSatisfaction(satisfactionRes.data);
        setDirectory(directoryRes.data ?? []);
      } catch {
        setError(t('hr.reportBuilder.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** The rows the chosen sections produce, previewed on screen and written to the CSV. */
  const rows = useMemo(() => {
    const output = [];
    const dash = (value, suffix = '') =>
      value === null || value === undefined ? t('hr.reportBuilder.notMeasurable') : `${value}${suffix}`;

    if (selected.has('indicators') && kpis?.hr) {
      const hr = kpis.hr;
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.completion'), dash(hr.completionRate, '%')]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.duration'), dash(hr.averageOnboardingDays, ` ${t('hr.reportBuilder.days')}`)]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.confirmation'), dash(hr.confirmationRate, '%')]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.turnover'), dash(hr.turnoverRate, '%')]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.cohort'), dash(hr.turnoverCohort)]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.satisfaction'), dash(hr.satisfaction, '%')]);
      output.push([t('hr.reportBuilder.sections.indicators'), t('hr.reportBuilder.rows.training'), dash(hr.trainingRate, '%')]);
    }

    if (selected.has('onboarding') && kpis?.onboarding) {
      const onboarding = kpis.onboarding;
      output.push([t('hr.reportBuilder.sections.onboarding'), t('hr.reportBuilder.rows.activeJourneys'), dash(onboarding.journeys)]);
      output.push([t('hr.reportBuilder.sections.onboarding'), t('hr.reportBuilder.rows.overdue'), dash(onboarding.overdueTasks)]);
      output.push([t('hr.reportBuilder.sections.onboarding'), t('hr.reportBuilder.rows.blocked'), dash(onboarding.blockedTasks)]);
      output.push([t('hr.reportBuilder.sections.onboarding'), t('hr.reportBuilder.rows.progress'), dash(onboarding.averagePercent, '%')]);
    }

    if (selected.has('satisfaction') && satisfaction) {
      output.push([t('hr.reportBuilder.sections.satisfaction'), t('hr.reportBuilder.rows.overall'), dash(satisfaction.score, '%')]);
      output.push([t('hr.reportBuilder.sections.satisfaction'), t('hr.reportBuilder.rows.responseRate'), dash(satisfaction.responseRate, '%')]);
      for (const milestone of satisfaction.byMilestone ?? []) {
        output.push([
          t('hr.reportBuilder.sections.satisfaction'),
          t('hr.reportBuilder.rows.milestone', { day: milestone.dayOffset }),
          dash(milestone.score, '%'),
        ]);
      }
    }

    if (selected.has('quality') && kpis?.quality) {
      output.push([t('hr.reportBuilder.sections.quality'), t('hr.reportBuilder.rows.units'), dash(kpis.quality.unitsWithoutHead)]);
      output.push([t('hr.reportBuilder.sections.quality'), t('hr.reportBuilder.rows.jobs'), dash(kpis.quality.jobsWithoutDescription)]);
      if (kpis.jobDescriptions) {
        output.push([t('hr.reportBuilder.sections.quality'), t('hr.reportBuilder.rows.coverage'), dash(kpis.jobDescriptions.coverage, '%')]);
      }
    }

    if (selected.has('directory')) {
      for (const person of directory) {
        output.push([
          t('hr.reportBuilder.sections.directory'),
          person.displayName,
          [
            person.positionFr ?? person.positionTitleFr ?? t('hr.reportBuilder.unknownPosition'),
            person.unitCode ?? t('hr.reportBuilder.noStructure'),
            person.managerName ?? t('hr.reportBuilder.noManager'),
            person.onboardingPercent === null ? t('hr.reportBuilder.noJourney') : `${person.onboardingPercent}%`,
          ].join(' — '),
        ]);
      }
    }

    return output;
  }, [selected, kpis, satisfaction, directory, t]);

  function handleExport() {
    const escape = (value) => {
      const text = String(value ?? '');
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      t('hr.reportBuilder.table.section'),
      t('hr.reportBuilder.table.indicator'),
      t('hr.reportBuilder.table.value'),
    ].join(',');
    const body = rows.map((row) => row.map(escape).join(',')).join('\r\n');
    const csv = `﻿${header}\r\n${body}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-rh-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageLoading label={t('hr.pages.report.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <Link to="/app/hr/analytics" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        {t('hr.reportBuilder.back')}
      </Link>

      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.pages.report.title')}
        subtitle={t('hr.pages.report.subtitle')}
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
          >
            {t('hr.reportBuilder.export')}
          </button>
        }
      />

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8"
      >
        <h2 className="mb-3 font-display text-lg text-text">{t('hr.reportBuilder.naturalTitle')}</h2>
        <EmptyState
          title={t('hr.reportBuilder.unavailable')}
          detail={t('hr.reportBuilder.naturalDetail')}
          muted
        />
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.06 }}
        className="mb-8"
      >
        <h2 className="mb-3 font-display text-lg text-text">{t('hr.reportBuilder.sectionsTitle')}</h2>
        <motion.div
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SECTIONS.map((section) => {
            const active = selected.has(section.id);
            return (
              <motion.button
                key={section.id}
                type="button"
                variants={staggerItem}
                onClick={() => toggle(section.id)}
                aria-pressed={active}
                className={`rounded-app border p-4 text-left transition-colors ${
                  active
                    ? 'border-red-brand bg-red-brand/5 shadow-app'
                    : 'border-border bg-surface text-text-dim hover:border-red-brand/50'
                }`}
              >
                <p className={`font-medium ${active ? 'text-red-deep' : 'text-text'}`}>
                  {t(`hr.reportBuilder.sectionLabels.${section.id}`)}
                </p>
                <p className="mt-1 text-xs text-text-dim">{t(`hr.reportBuilder.sectionDetails.${section.id}`)}</p>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.12 }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg text-text">{t('hr.reportBuilder.preview')}</h2>
          <span className="text-sm text-text-dim">
            {t('hr.reportBuilder.rowCount', { count: rows.length })}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState detail={t('hr.reportBuilder.selectSection')} muted />
        ) : (
          <div className={`max-h-[32rem] overflow-auto ${CARD}`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('hr.reportBuilder.table.section')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.reportBuilder.table.indicator')}</th>
                  <th className="px-4 py-3 font-medium">{t('hr.reportBuilder.table.value')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row[0]}-${row[1]}-${index}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
                      {row[0]}
                    </td>
                    <td className="px-4 py-2 text-text">{row[1]}</td>
                    <td className="px-4 py-2 font-mono text-xs text-text-dim">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    </div>
  );
}
