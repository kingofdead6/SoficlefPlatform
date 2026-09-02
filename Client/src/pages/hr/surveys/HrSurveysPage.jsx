import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { alertsApi } from '../../../api/alerts.js';
import { surveysApi } from '../../../api/surveys.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

export const INDICATOR_LABELS = {
  WELCOME_QUALITY: 'Qualité de l’accueil',
  SUPPORT_LEVEL: 'Accompagnement reçu',
  ROLE_CLARITY: 'Clarté du rôle',
  MANAGER_RELATIONSHIP: 'Relation avec le manager',
  WORKING_CONDITIONS: 'Conditions de travail',
};

const MILESTONE_DESCRIPTIONS = {
  7: 'Première semaine — accueil, matériel, premiers repères.',
  30: 'Premier mois — clarté du rôle et accompagnement.',
  60: 'Deux mois — autonomie et intégration dans l’équipe.',
  90: 'Fin de période d’essai — bilan global.',
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
        setError('Impossible de charger la configuration des enquêtes.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const surveyRules = useMemo(
    () => rules.filter((rule) => rule.trigger === 'SURVEY_UNANSWERED'),
    [rules],
  );

  if (loading) return <PageLoading label="Chargement des enquêtes…" />;
  if (error) return <PageError message={error} />;

  const milestones = results?.byMilestone ?? satisfaction?.byMilestone ?? [];
  const indicators = satisfaction?.indicators ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Enquêtes de satisfaction"
        subtitle="Les jalons, le questionnaire et les règles de relance qui encadrent le suivi d’intégration."
        actions={
          <>
            <Link
              to="/app/hr/alerts"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Règles de relance
            </Link>
            <Link
              to="/app/hr/surveys/results"
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              Voir les résultats
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
            Enquêtes émises
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={satisfaction?.roundsIssued ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Renseignées
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={satisfaction?.roundsAnswered ?? 0} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            En retard
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
            Taux de réponse
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
        <h2 className="font-display text-xl text-text">Jalons d’enquête</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les quatre jalons sont générés automatiquement à l’affectation, à partir de la date
          d’embauche. Ils sont définis dans le domaine (J+7, J+30, J+60, J+90) et s’appliquent à tout
          parcours ; les modifier relèverait d’un changement de modèle, pas d’un réglage.
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
                  {milestone.answered}
                  {milestone.issued !== undefined ? `/${milestone.issued}` : ''} réponses
                </span>
              </div>
              <p className="mb-3 text-xs text-text-dim">
                {MILESTONE_DESCRIPTIONS[milestone.dayOffset] ?? ''}
              </p>
              <div className="flex items-center gap-3">
                <ProgressRing percent={milestone.score ?? 0} label={milestone.score === null ? '—' : undefined} />
                <span className="text-xs text-text-dim">Score de satisfaction</span>
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
        <h2 className="font-display text-xl text-text">Questionnaire</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les cinq indicateurs notés de 1 à 5 qui composent chaque enquête. Ce sont des valeurs
          d’énumération en base : ajouter un indicateur suppose une migration, la liste n’est donc pas
          modifiable depuis l’interface.
        </p>
        <div className={`overflow-hidden ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Indicateur</th>
                <th className="px-4 py-3 font-medium">Moyenne (/5)</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Réponses</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
                <tr key={indicator.indicator} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">
                    {INDICATOR_LABELS[indicator.indicator] ?? indicator.indicator}
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
        <h2 className="font-display text-xl text-text">Règles de relance</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les règles qui déclenchent une relance sur une enquête restée sans réponse. Elles se
          configurent sur la page des alertes.
        </p>
        {surveyRules.length === 0 ? (
          <EmptyState
            title="Aucune règle de relance sur les enquêtes"
            detail="Rien ne relance automatiquement une enquête sans réponse aujourd’hui. Créez une règle « enquête sans réponse » depuis la page Alertes."
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
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-dim">
                  Relance après {rule.thresholdDays} jour(s), notification à {rule.notifyDepartment}
                  {rule.escalateAfterDays
                    ? `, escalade après ${rule.escalateAfterDays} jour(s).`
                    : ', sans escalade.'}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
