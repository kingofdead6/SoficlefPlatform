import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { jobDescriptionsApi } from '../../../api/jobDescriptions.js';
import { organizationUnitsApi, positionsApi } from '../../../api/organization.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';
import { staggerContainer, staggerItem, rowVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const EMPTY_FORM = {
  code: '',
  titleFr: '',
  missionFr: '',
  organizationUnitId: '',
  parentPositionId: '',
};

/**
 * /app/hr/positions (route guide §2.3, CORE).
 * "CRUD on job descriptions (title, mission, reporting line, required skills); each is a
 * node in the org tree."
 *
 * A `Position` *is* the node in the org tree, and it carries the title, the mission and the
 * reporting line (`parentPositionId`) — so those are edited here, against
 * POST/PATCH/DELETE /positions.
 *
 * DEVIATION — "required skills": the competency requirements of a post live on
 * `JobDescription`/`JobCompetency`, a separate versioned, validated document with its own
 * review workflow (job-descriptions.routes.js). Editing skills inline here would bypass that
 * workflow and its validation state, so each row links to its job-description dossier
 * instead, and the coverage column shows which posts still lack one.
 *
 * HR holds `position:read` but not `position:create/update/delete` — the catalogue gives
 * those to ADMIN. The write controls are therefore rendered only for a caller who actually
 * holds them, rather than being shown and then failing with a 403.
 */
export default function HrPositionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [units, setUnits] = useState([]);
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const canCreate = can(user, 'create', 'position');
  const canUpdate = can(user, 'update', 'position');
  const canDelete = can(user, 'delete', 'position');

  const load = useCallback(async () => {
    try {
      const [positionsRes, unitsRes] = await Promise.all([
        positionsApi.list(),
        organizationUnitsApi.list(),
      ]);
      setPositions(positionsRes.data);
      setUnits(unitsRes.data);
      setError(null);
    } catch {
      setError(t('hr.positions.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Job-description coverage: which posts already have a fiche, and where it stands.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await jobDescriptionsApi.list();
        setJobDescriptions(data ?? []);
      } catch {
        // Without job_description:read the coverage column is simply omitted.
        setJobDescriptions([]);
      }
    })();
  }, []);

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const positionById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  const jdByPositionId = useMemo(() => {
    const map = new Map();
    for (const jd of jobDescriptions) {
      const positionId = jd.positionId ?? jd.position?.id;
      if (positionId) map.set(positionId, jd);
    }
    return map;
  }, [jobDescriptions]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return positions.filter((position) => {
      if (unitFilter && position.organizationUnitId !== unitFilter) return false;
      if (!term) return true;
      return (
        position.titleFr.toLowerCase().includes(term) ||
        position.code.toLowerCase().includes(term) ||
        (position.missionFr ?? '').toLowerCase().includes(term)
      );
    });
  }, [positions, search, unitFilter]);

  const stats = useMemo(
    () => ({
      total: positions.length,
      vacant: positions.filter((position) => position.isVacant).length,
      withoutJd: positions.filter((position) => !jdByPositionId.has(position.id)).length,
    }),
    [positions, jdByPositionId],
  );

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(position) {
    setEditingId(position.id);
    setForm({
      code: position.code,
      titleFr: position.titleFr,
      missionFr: position.missionFr ?? '',
      organizationUnitId: position.organizationUnitId ?? '',
      parentPositionId: position.parentPositionId ?? '',
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        // PATCH /positions/:id does not accept `code` or `organizationUnitId`: moving a post
        // between structures changes who may see it, which is an administration act.
        await positionsApi.update(editingId, {
          titleFr: form.titleFr,
          missionFr: form.missionFr || null,
          parentPositionId: form.parentPositionId || null,
        });
      } else {
        await positionsApi.create({
          code: form.code,
          titleFr: form.titleFr,
          missionFr: form.missionFr || null,
          organizationUnitId: form.organizationUnitId || null,
          parentPositionId: form.parentPositionId || null,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.positions.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(position) {
    if (!window.confirm(t('hr.positions.archiveConfirm', { title: position.titleFr }))) return;
    try {
      await positionsApi.archive(position.id);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.positions.archiveError'));
    }
  }

  if (loading) return <PageLoading label={t('hr.positions.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.positions.title')}
        subtitle={t('hr.positions.subtitle')}
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('hr.positions.newPosition')}
            </button>
          ) : null
        }
      />

      {!canCreate && !canUpdate && (
        <div className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          {t('hr.positions.readOnlyNotice')}{' '}
          (<code>position:create</code> / <code>position:update</code>).
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.positions.stats.active')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.positions.stats.vacant')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.vacant} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.positions.stats.withoutDescription')}
          </p>
          <p
            className={`font-display text-3xl ${stats.withoutJd > 0 ? 'text-status-amber' : 'text-red-deep'}`}
          >
            <CountUp value={stats.withoutJd} />
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">
                {editingId ? t('hr.positions.form.editTitle') : t('hr.positions.form.newTitle')}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.positions.form.code')}</label>
                  <input
                    required
                    disabled={Boolean(editingId)}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className={`${fieldClass} disabled:opacity-60`}
                  />
                  {editingId && (
                    <p className="mt-1 text-xs text-text-dim">
                      {t('hr.positions.form.codeHint')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.positions.form.title')}</label>
                  <input
                    required
                    value={form.titleFr}
                    onChange={(e) => setForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.positions.form.mission')}</label>
                <textarea
                  rows={3}
                  value={form.missionFr}
                  onChange={(e) => setForm((f) => ({ ...f, missionFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.positions.form.structure')}</label>
                  <select
                    disabled={Boolean(editingId)}
                    value={form.organizationUnitId}
                    onChange={(e) => setForm((f) => ({ ...f, organizationUnitId: e.target.value }))}
                    className={`${fieldClass} disabled:opacity-60`}
                  >
                    <option value="">{t('hr.positions.form.noStructure')}</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} — {unit.nameFr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    {t('hr.positions.form.parent')}
                  </label>
                  <select
                    value={form.parentPositionId}
                    onChange={(e) => setForm((f) => ({ ...f, parentPositionId: e.target.value }))}
                    className={fieldClass}
                  >
                    <option value="">{t('hr.positions.form.noParent')}</option>
                    {positions
                      .filter((position) => position.id !== editingId)
                      .map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.titleFr} ({position.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {formError && <p className="text-sm text-status-red">{formError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition hover:bg-surface-2"
                >
                  {t('hr.positions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {submitting ? t('hr.positions.saving') : t('hr.positions.save')}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className={`${CARD} mb-6 flex flex-wrap items-center gap-3 p-4`}>
        <input
          type="search"
          placeholder={t('hr.positions.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${fieldClass} min-w-[240px] flex-1`}
        />
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className={`${fieldClass} w-auto`}
        >
          <option value="">{t('hr.positions.allStructures')}</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code} — {unit.nameFr}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-text-dim">
          {t('hr.positions.positionCount', { visible: visible.length, total: positions.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState detail={t('hr.positions.empty')} muted />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.code')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.title')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.structure')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.parent')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.occupation')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.positions.table.description')}</th>
                {(canUpdate || canDelete) && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer(0.03, 0.15)}
              initial={initialOrNone(reduce)}
              animate="visible"
            >
              {visible.map((position) => {
                const jd = jdByPositionId.get(position.id);
                return (
                  <motion.tr
                    key={position.id}
                    variants={rowVariants}
                    className="border-b border-border last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-text-dim">{position.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{position.titleFr}</p>
                      {position.missionFr && (
                        <p className="max-w-md truncate text-xs text-text-dim">{position.missionFr}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {unitById.get(position.organizationUnitId)?.code ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {positionById.get(position.parentPositionId)?.titleFr ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          position.isVacant
                            ? 'bg-red-brand/10 text-red-brand'
                            : 'bg-status-green/10 text-status-green'
                        }`}
                      >
                        {position.isVacant ? t('hr.positions.vacant') : t('hr.positions.occupied')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {jd ? (
                        <a
                          href={`/job-description/${jd.id}`}
                          className="text-red-brand hover:underline"
                        >
                          {t('hr.positions.viewDescription')}
                        </a>
                      ) : (
                        <span className="text-status-amber">{t('hr.positions.missingDescription')}</span>
                      )}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-4 py-3 text-end">
                        <div className="flex justify-end gap-3">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => openEdit(position)}
                              className="text-xs text-red-brand hover:underline"
                            >
                              {t('hr.positions.edit')}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleArchive(position)}
                              className="text-xs text-status-red hover:underline"
                            >
                              {t('hr.positions.archive')}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
