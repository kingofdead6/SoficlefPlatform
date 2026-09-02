import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

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
  { id: 'indicators', labelFr: 'Indicateurs RH (Module 10)', detailFr: 'Complétion, durée, confirmation, turnover, satisfaction, formation.' },
  { id: 'onboarding', labelFr: 'Santé des parcours', detailFr: 'Parcours actifs, étapes en retard et bloquées, avancement moyen.' },
  { id: 'satisfaction', labelFr: 'Satisfaction par jalon', detailFr: 'Score et taux de réponse pour J+7, J+30, J+60, J+90.' },
  { id: 'directory', labelFr: 'Répertoire des collaborateurs', detailFr: 'Nom, poste, structure, manager, état, avancement.' },
  { id: 'quality', labelFr: 'Qualité des données', detailFr: 'Structures sans responsable, postes sans fiche de poste.' },
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
        setError('Impossible de charger les données du rapport.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      value === null || value === undefined ? 'non mesurable' : `${value}${suffix}`;

    if (selected.has('indicators') && kpis?.hr) {
      const hr = kpis.hr;
      output.push(['Indicateurs RH', 'Taux de complétion des parcours', dash(hr.completionRate, '%')]);
      output.push(['Indicateurs RH', 'Durée moyenne d’intégration', dash(hr.averageOnboardingDays, ' jours')]);
      output.push(['Indicateurs RH', 'Taux de confirmation', dash(hr.confirmationRate, '%')]);
      output.push(['Indicateurs RH', 'Turnover à six mois', dash(hr.turnoverRate, '%')]);
      output.push(['Indicateurs RH', 'Cohorte turnover', dash(hr.turnoverCohort)]);
      output.push(['Indicateurs RH', 'Satisfaction', dash(hr.satisfaction, '%')]);
      output.push(['Indicateurs RH', 'Formation à jour', dash(hr.trainingRate, '%')]);
    }

    if (selected.has('onboarding') && kpis?.onboarding) {
      const onboarding = kpis.onboarding;
      output.push(['Parcours', 'Parcours actifs', dash(onboarding.journeys)]);
      output.push(['Parcours', 'Étapes en retard', dash(onboarding.overdueTasks)]);
      output.push(['Parcours', 'Étapes bloquées', dash(onboarding.blockedTasks)]);
      output.push(['Parcours', 'Avancement moyen', dash(onboarding.averagePercent, '%')]);
    }

    if (selected.has('satisfaction') && satisfaction) {
      output.push(['Satisfaction', 'Score global', dash(satisfaction.score, '%')]);
      output.push(['Satisfaction', 'Taux de réponse', dash(satisfaction.responseRate, '%')]);
      for (const milestone of satisfaction.byMilestone ?? []) {
        output.push([
          'Satisfaction',
          `Score J+${milestone.dayOffset}`,
          dash(milestone.score, '%'),
        ]);
      }
    }

    if (selected.has('quality') && kpis?.quality) {
      output.push(['Qualité des données', 'Structures sans responsable', dash(kpis.quality.unitsWithoutHead)]);
      output.push(['Qualité des données', 'Postes sans fiche de poste', dash(kpis.quality.jobsWithoutDescription)]);
      if (kpis.jobDescriptions) {
        output.push(['Qualité des données', 'Couverture des fiches de poste', dash(kpis.jobDescriptions.coverage, '%')]);
      }
    }

    if (selected.has('directory')) {
      for (const person of directory) {
        output.push([
          'Répertoire',
          person.displayName,
          [
            person.positionFr ?? person.positionTitleFr ?? 'poste non renseigné',
            person.unitCode ?? 'sans structure',
            person.managerName ?? 'sans manager',
            person.onboardingPercent === null ? 'hors parcours' : `${person.onboardingPercent}%`,
          ].join(' — '),
        ]);
      }
    }

    return output;
  }, [selected, kpis, satisfaction, directory]);

  function handleExport() {
    const escape = (value) => {
      const text = String(value ?? '');
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ['Section', 'Indicateur', 'Valeur'].join(',');
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

  if (loading) return <PageLoading label="Chargement des données…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <Link to="/app/hr/analytics" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        ← Retour à l’analytique
      </Link>

      <PageHeader
        eyebrow="Ressources humaines"
        title="Générateur de rapports"
        subtitle="Composer un rapport à partir des indicateurs que la plateforme calcule réellement, et l’exporter."
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
          >
            Exporter le rapport (CSV)
          </button>
        }
      />

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8"
      >
        <h2 className="mb-3 font-display text-lg text-text">Rédaction en langage naturel</h2>
        <EmptyState
          title="Non disponible"
          detail="La rédaction automatique d’un rapport (« Agent 5 ») suppose un fournisseur de modèle de langage, dont aucun n’est raccordé à cette plateforme — c’est une décision d’architecture assumée (ADR-003), pas une panne. Aucune interface de conversation n’est donc proposée ici : elle ne produirait rien de réel. Les données ci-dessous, elles, sont celles que la plateforme calcule effectivement, et sont exportables telles quelles."
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
        <h2 className="mb-3 font-display text-lg text-text">Sections du rapport</h2>
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
                  {section.labelFr}
                </p>
                <p className="mt-1 text-xs text-text-dim">{section.detailFr}</p>
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
          <h2 className="font-display text-lg text-text">Aperçu</h2>
          <span className="text-sm text-text-dim">
            {rows.length} ligne{rows.length > 1 ? 's' : ''}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState detail="Sélectionnez au moins une section pour composer un rapport." muted />
        ) : (
          <div className={`max-h-[32rem] overflow-auto ${CARD}`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Indicateur</th>
                  <th className="px-4 py-3 font-medium">Valeur</th>
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
