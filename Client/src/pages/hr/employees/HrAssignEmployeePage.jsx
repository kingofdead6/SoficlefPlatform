import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { assignmentsApi, organizationUnitsApi, positionsApi } from '../../../api/organization.js';
import { templatesApi } from '../../../api/templates.js';
import { usersApi } from '../../../api/users.js';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/hr/employees/[id]/assign (route guide §2.3, CORE).
 * "Assignment form: pick position, division/dept, direct manager, hire date, onboarding
 * template, equipment; confirm → path generated, org node placed."
 *
 * The confirm posts to POST /assignments, which in one transaction closes any open
 * assignment, opens the new one, marks the position occupied (that *is* the org-node
 * placement — a position is a node), flips the lifecycle state, creates the onboarding
 * instance from the chosen template and generates its J+7/30/60/90 survey rounds.
 *
 * DEVIATION — "equipment": no equipment/asset model exists in prisma/schema.prisma, and
 * Assignment has no field to carry one. Rather than drop the spec line or fake a checklist
 * that saves nowhere, the equipment step is expressed through the mechanism the platform
 * really has: the onboarding template's IT-owned milestones, which are listed here from the
 * chosen template so HR can see exactly what the path will provision. The note below says
 * this plainly.
 *
 * The division/department select filters the position list rather than being stored
 * separately — a position already belongs to an organization unit, so storing the unit
 * again on the assignment would let the two disagree.
 */
export default function HrAssignEmployeePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [positions, setPositions] = useState([]);
  const [units, setUnits] = useState([]);
  const [managers, setManagers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateDetail, setTemplateDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const [form, setForm] = useState({
    unitId: '',
    positionId: '',
    managerOverrideId: '',
    startDate: '',
    templateId: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [employeeRes, pendingRes, vacantRes, unitsRes, facetsRes, templatesRes] = await Promise.all([
          /*
           * A unit-scoped HR account cannot read an *unassigned* person through
           * GET /users/:id: hr/directory.js scopes that read by the person's current
           * assignment, which by definition they do not have yet. The pending-accounts
           * queue — the very list this page is reached from — does return them, so it is
           * used as the fallback identity rather than showing "collaborateur introuvable"
           * for exactly the people this form exists to place.
           */
          usersApi.get(id).catch(() => null),
          assignmentsApi.pendingAccounts().catch(() => ({ data: [] })),
          assignmentsApi.vacantPositions(),
          organizationUnitsApi.list(),
          usersApi.facets(),
          templatesApi.list(),
        ]);

        const fallback = pendingRes.data.find((account) => account.id === id) ?? null;
        setEmployee(employeeRes?.data ?? fallback);
        setUnits(unitsRes.data);
        setManagers(facetsRes.data.managers);
        setTemplates(templatesRes.data);

        /*
         * The vacant-positions endpoint returns only id/code/titleFr/occupancyFr, with no
         * organization unit — which the division filter needs. The full position list
         * carries organizationUnitId, so the two are joined here rather than adding a
         * second server endpoint that would return almost the same rows.
         */
        const allRes = await positionsApi.list();
        const unitByPosition = new Map(allRes.data.map((p) => [p.id, p.organizationUnitId]));
        setPositions(
          vacantRes.data.map((position) => ({
            ...position,
            organizationUnitId: unitByPosition.get(position.id) ?? null,
          })),
        );
      } catch {
        setError('Impossible de charger le formulaire d’affectation.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // The chosen template's steps, so HR sees the path (and its IT provisioning) before confirming.
  useEffect(() => {
    if (!form.templateId) {
      setTemplateDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await templatesApi.get(form.templateId);
        if (!cancelled) setTemplateDetail(data);
      } catch {
        if (!cancelled) setTemplateDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.templateId]);

  const visiblePositions = useMemo(
    () =>
      form.unitId
        ? positions.filter((position) => position.organizationUnitId === form.unitId)
        : positions,
    [positions, form.unitId],
  );

  const equipmentSteps = useMemo(
    () => (templateDetail?.milestones ?? []).filter((m) => m.ownerDepartment === 'IT'),
    [templateDetail],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await assignmentsApi.assign({
        userId: id,
        positionId: form.positionId,
        startDate: form.startDate,
        managerOverrideId: form.managerOverrideId || null,
        templateId: form.templateId || null,
      });
      navigate(`/app/hr/employees/${id}`);
    } catch (err) {
      setFormError(err.body?.message ?? 'L’affectation a échoué.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement…" />;
  if (error) return <PageError message={error} />;
  if (!employee) {
    return (
      <PageError message="Ce collaborateur est introuvable ou hors de votre périmètre d’affectation." />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/hr/employees/unassigned"
        className="mb-4 inline-block text-sm text-red-brand hover:underline"
      >
        ← Retour à la file d’affectation
      </Link>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 border-b border-border pb-6"
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-brand">
          Ressources humaines
        </p>
        <h1 className="mb-1 font-display text-3xl text-red-deep">Affecter un collaborateur</h1>
        <p className="text-text-dim">
          {employee.displayName} — {employee.email}
        </p>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: reduce ? 0 : 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4 rounded-app border border-border bg-surface p-6 shadow-app"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Direction / service</label>
            <select
              value={form.unitId}
              onChange={(e) => setForm((prev) => ({ ...prev, unitId: e.target.value, positionId: '' }))}
              className={fieldClass}
            >
              <option value="">Toutes les structures</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} — {unit.nameFr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Poste</label>
            <select
              required
              value={form.positionId}
              onChange={(e) => setForm((prev) => ({ ...prev, positionId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">Choisir un poste vacant…</option>
              {visiblePositions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.titleFr} ({position.code})
                </option>
              ))}
            </select>
            {visiblePositions.length === 0 && (
              <p className="mt-1 text-xs text-text-dim">
                Aucun poste vacant dans cette structure.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Manager direct</label>
            <select
              value={form.managerOverrideId}
              onChange={(e) => setForm((prev) => ({ ...prev, managerOverrideId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">Manager hiérarchique du poste</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-dim">
              Laisser vide pour suivre la ligne hiérarchique de l’organigramme.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Date d’embauche</label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text">Modèle de parcours</label>
          <select
            value={form.templateId}
            onChange={(e) => setForm((prev) => ({ ...prev, templateId: e.target.value }))}
            className={fieldClass}
          >
            <option value="">Aucun parcours d’intégration</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.titleFr} ({template.milestoneCount} étapes)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-text-dim">
            À la confirmation, le parcours est généré et les enquêtes J+7 / J+30 / J+60 / J+90 sont
            créées.
          </p>
        </div>

        <AnimatePresence initial={false}>
          {templateDetail && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-app border border-border bg-surface-2 p-4">
                <p className="mb-2 text-sm font-medium text-text">
                  Équipements et accès prévus par le parcours
                </p>
                {equipmentSteps.length === 0 ? (
                  <p className="text-xs text-text-dim">
                    Ce modèle ne comporte aucune étape confiée au SI. L’équipement n’est pas modélisé
                    séparément dans la plateforme : il est provisionné par les étapes « SI » du
                    parcours.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {equipmentSteps.map((step) => (
                      <li key={step.id} className="flex items-baseline gap-2 text-xs text-text-dim">
                        <span className="font-mono text-[10px] text-red-brand">{step.dayLabelFr}</span>
                        <span>{step.titleFr}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {formError && (
            <motion.p
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-status-red"
            >
              {formError}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            to="/app/hr/employees/unassigned"
            className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition hover:bg-surface-2"
          >
            Annuler
          </Link>
          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={reduce || submitting ? undefined : { scale: 1.03 }}
            whileTap={reduce || submitting ? undefined : { scale: 0.97 }}
            className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={submitting ? 'submitting' : 'idle'}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2"
              >
                {submitting && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {submitting ? 'Affectation…' : 'Confirmer l’affectation'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}
