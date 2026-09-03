import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { assignmentsApi } from '../../../api/organization.js';
import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-lg text-text';

const LIFECYCLE_LABELS = {
  PENDING_ASSIGNMENT: 'En attente d’affectation',
  ASSIGNED: 'Affecté',
  ONBOARDING: 'En intégration',
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
};

const OUTCOME_LABELS = {
  CONFIRMED: 'Confirmé',
  EXTENDED: 'Prolongé',
  TERMINATED: 'Rompu',
  RESIGNED: 'Démission',
};

const FILE_STATUS_LABELS = {
  MISSING: 'Manquant',
  SUBMITTED: 'Déposé',
  VALIDATED: 'Validé',
  REJECTED: 'Refusé',
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—');

/**
 * /app/hr/employees/[id] (route guide §2.3, CORE).
 * "Employee detail: full record, path, documents, training, surveys, evaluations; reassign;
 * restart/adjust path; archive."
 *
 * Everything on this page comes from one call: `loadEmployee` (application/hr/directory.js)
 * already returns the record, the assignment history, the onboarding instances with their
 * task completions and survey rounds, the personal files, the training attempts and the
 * document acknowledgements. A second composite endpoint would have duplicated that query.
 *
 * The three actions differ in what the platform can actually back:
 *  - Reassign: real. Closing the open assignment (PATCH /assignments/:id/end) then placing
 *    the person again through the assignment form, which is exactly the two-step the domain
 *    models — assignments are never deleted, because the history is what turnover reads.
 *  - Restart / adjust path: partially real. Re-running the assignment form with a different
 *    template re-points the running instance and regenerates its survey rounds (see
 *    assignToPosition). There is no "reset every task to TODO" mutation, and adding one
 *    would silently destroy validated steps, so that is stated rather than faked.
 *  - Archive: NOT available to HR. Archiving a person is `user:update`, which the permission
 *    catalogue deliberately withholds from HR (HR places people; SI owns the account). The
 *    control says so and points at the administration console instead of failing with a 403.
 */
export default function HrEmployeeDetailPage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [ending, setEnding] = useState(false);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await usersApi.get(id);
      setEmployee(data);
      setError(null);
    } catch {
      setError('Collaborateur introuvable ou hors de votre périmètre.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssignment = useMemo(
    () => employee?.assignments?.find((assignment) => assignment.endDate === null) ?? null,
    [employee],
  );

  const journey = useMemo(() => {
    const instance = employee?.onboardingInstances?.[0];
    if (!instance) return null;
    const total = instance.template?._count?.milestones ?? 0;
    const done = instance.taskCompletions.filter(
      (task) => task.status === 'DONE' || task.status === 'VALIDATED',
    ).length;
    return {
      ...instance,
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      blocked: instance.taskCompletions.filter((task) => task.status === 'BLOCKED').length,
    };
  }, [employee]);

  async function handleEndAssignment() {
    if (!openAssignment) return;
    if (
      !window.confirm(
        'Clôturer l’affectation en cours ? Le poste redevient vacant et le collaborateur repasse en attente d’affectation.',
      )
    ) {
      return;
    }
    setEnding(true);
    setActionError(null);
    try {
      await assignmentsApi.end(openAssignment.id, new Date().toISOString().slice(0, 10));
      await load();
    } catch (err) {
      setActionError(err.body?.message ?? 'La clôture de l’affectation a échoué.');
    } finally {
      setEnding(false);
    }
  }

  if (loading) return <PageLoading label="Chargement du dossier…" />;
  if (error) return <PageError message={error} />;
  if (!employee) return null;

  return (
    <div>
      <Link to="/app/hr/employees" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        <span aria-hidden className="rtl:-scale-x-100">←</span> Retour au répertoire
      </Link>

      <PageHeader
        eyebrow="Ressources humaines"
        title={employee.displayName}
        subtitle={`${employee.positionTitleFr ?? openAssignment?.position.titleFr ?? 'Poste non renseigné'} — ${
          LIFECYCLE_LABELS[employee.lifecycleState] ?? employee.lifecycleState
        }`}
        actions={
          <>
            <Link
              to={`/app/hr/employees/${id}/assign`}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {openAssignment ? 'Réaffecter' : 'Affecter'}
            </Link>
            {openAssignment && (
              <button
                type="button"
                onClick={handleEndAssignment}
                disabled={ending}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-status-red hover:text-status-red disabled:opacity-50"
              >
                {ending ? 'Clôture…' : 'Clôturer l’affectation'}
              </button>
            )}
          </>
        }
      />

      <AnimatePresence>
        {actionError && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-app border border-status-red/30 bg-status-red/5 p-3 text-sm text-status-red"
          >
            {actionError}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Record */}
        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="lg:col-span-1"
        >
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Dossier</h2>
          <dl className={`${CARD} space-y-3 p-5 text-sm`}>
            <Field label="Adresse e-mail" value={employee.email} />
            <Field label="Téléphone" value={employee.phone ?? '—'} />
            <Field label="Direction" value={employee.directionFr ?? '—'} />
            <Field label="Service" value={employee.serviceFr ?? '—'} />
            <Field label="Manager" value={employee.manager?.displayName ?? '—'} />
            <Field label="Date d’embauche" value={formatDate(employee.hireDate)} />
            <Field label="Début d’intégration" value={formatDate(employee.onboardingStartDate)} />
            <Field label="Compte créé le" value={formatDate(employee.createdAt)} />
            <Field
              label="Rôles"
              value={
                employee.userRoles.length === 0
                  ? '—'
                  : employee.userRoles.map((entry) => entry.role.code).join(', ')
              }
            />
          </dl>

          <div className="mt-4 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
            <p className="mb-1 font-medium text-text-muted">Archivage</p>
            L’archivage d’un compte relève du SI (permission <code>user:update</code>), que les RH ne
            détiennent pas : les RH affectent, le SI possède le compte. Pour archiver, passez par la
            console d’administration. Clôturer l’affectation ci-dessus libère le poste sans toucher au
            compte.
          </div>
        </motion.section>

        {/* Journey */}
        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.06 }}
          className="lg:col-span-2"
        >
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Parcours d’intégration</h2>
          {!journey ? (
            <EmptyState
              title="Aucun parcours"
              detail="Ce collaborateur n’a pas encore de parcours d’intégration. Affectez-le avec un modèle de parcours pour en générer un."
              muted
            />
          ) : (
            <div className={`${CARD} p-5`}>
              <div className="flex flex-wrap items-center gap-6">
                <ProgressRing
                  percent={journey.percent}
                  tone={journey.blocked > 0 ? 'red' : journey.percent >= 100 ? 'green' : 'brand'}
                />
                <div className="min-w-0">
                  <p className="font-medium text-text">
                    {journey.template?.titleFr ?? 'Modèle supprimé'}
                  </p>
                  <p className="text-xs text-text-dim">
                    Démarré le {formatDate(journey.startDate)} — {journey.done}/{journey.total} étapes
                    {journey.blocked > 0 ? ` — ${journey.blocked} bloquée(s)` : ''}
                  </p>
                  <p className="mt-1 text-xs text-text-dim">
                    Période d’essai :{' '}
                    {journey.probationOutcome
                      ? (OUTCOME_LABELS[journey.probationOutcome] ?? journey.probationOutcome)
                      : 'en cours'}
                    {journey.completedAt ? ` — terminé le ${formatDate(journey.completedAt)}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-4 text-xs text-text-dim">
                <p className="mb-1 font-medium text-text-muted">Reprendre ou ajuster le parcours</p>
                Réaffecter le collaborateur avec un autre modèle repointe le parcours en cours sur ce
                modèle et régénère les enquêtes J+7 / J+30 / J+60 / J+90. Il n’existe pas de remise à
                zéro des étapes déjà validées : les remettre à « à faire » effacerait des validations
                signées, ce que la plateforme ne fait pas silencieusement.
              </div>
            </div>
          )}

          {/* Surveys */}
          <h2 className={`mb-3 mt-8 ${SECTION_TITLE}`}>Enquêtes de satisfaction</h2>
          {!journey || journey.surveyRounds.length === 0 ? (
            <EmptyState detail="Aucune enquête émise pour ce collaborateur." muted />
          ) : (
            <motion.div
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="grid gap-3 sm:grid-cols-4"
            >
              {journey.surveyRounds.map((round) => (
                <motion.div
                  key={round.dayOffset}
                  variants={staggerItem}
                  className={`${CARD} p-4 text-center`}
                >
                  <p className="font-mono text-xs text-red-brand">J+{round.dayOffset}</p>
                  <p className="mt-1 text-sm font-medium text-text">
                    {round._count.responses > 0 ? 'Renseignée' : 'En attente'}
                  </p>
                  <p className="text-xs text-text-dim">Échéance {formatDate(round.dueDate)}</p>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Training */}
          <h2 className={`mb-3 mt-8 ${SECTION_TITLE}`}>Formation</h2>
          {employee.trainingAttempts.length === 0 ? (
            <EmptyState detail="Aucune tentative de module de formation enregistrée." muted />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                    <th className="px-4 py-3 font-medium">Module</th>
                    <th className="px-4 py-3 font-medium">Obligatoire</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Résultat</th>
                    <th className="px-4 py-3 font-medium">Passé le</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.trainingAttempts.map((attempt, index) => (
                    <tr
                      key={`${attempt.module.titleFr}-${index}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 text-text">{attempt.module.titleFr}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {attempt.module.isMandatory ? 'Oui' : 'Non'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-dim">{attempt.score}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            attempt.passed
                              ? 'bg-status-green/10 text-status-green'
                              : 'bg-status-red/10 text-status-red'
                          }`}
                        >
                          {attempt.passed ? 'Réussi' : 'Échoué'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-dim">{formatDate(attempt.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Documents + files */}
          <h2 className={`mb-3 mt-8 ${SECTION_TITLE}`}>Documents</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                Documents acquittés
              </p>
              {employee.documentAcknowledgements.length === 0 ? (
                <p className="text-sm text-text-dim">Aucun accusé de lecture.</p>
              ) : (
                <ul className="space-y-2">
                  {employee.documentAcknowledgements.map((ack, index) => (
                    <li key={`${ack.document.titleFr}-${index}`} className="text-sm">
                      <span className="text-text">{ack.document.titleFr}</span>
                      <span className="ms-2 text-xs text-text-dim">
                        {formatDate(ack.acceptedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`${CARD} p-5`}>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                Pièces justificatives
              </p>
              {employee.personalFiles.length === 0 ? (
                <p className="text-sm text-text-dim">Aucune pièce demandée.</p>
              ) : (
                <ul className="space-y-2">
                  {employee.personalFiles.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-text">{file.labelFr}</span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                        {FILE_STATUS_LABELS[file.status] ?? file.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Assignment history */}
          <h2 className={`mb-3 mt-8 ${SECTION_TITLE}`}>Historique des affectations</h2>
          {employee.assignments.length === 0 ? (
            <EmptyState detail="Ce collaborateur n’a jamais été affecté." muted />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                    <th className="px-4 py-3 font-medium">Poste</th>
                    <th className="px-4 py-3 font-medium">Structure</th>
                    <th className="px-4 py-3 font-medium">Du</th>
                    <th className="px-4 py-3 font-medium">Au</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text">{assignment.position.titleFr}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {assignment.position.organizationUnit?.nameFr ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-dim">{formatDate(assignment.startDate)}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {assignment.endDate ? formatDate(assignment.endDate) : 'En cours'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-dim">{label}</dt>
      <dd className="min-w-0 truncate text-end text-text">{value}</dd>
    </div>
  );
}
