import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { templatesApi } from '../../../api/templates.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none transition-colors focus:border-red-brand';

const DEPARTMENTS = [
  { value: 'HR' },
  { value: 'IT' },
  { value: 'HSE' },
  { value: 'QUALITY' },
  { value: 'MANAGER' },
  { value: 'EMPLOYEE' },
];

const PHASES = [
  { value: 'PRE_ONBOARDING' },
  { value: 'DAY_ONE' },
  { value: 'PROBATION' },
];

/** J-7 / J0 / J+15 from the numeric offset, so the label and the offset never disagree. */
function dayLabelFor(offset) {
  if (offset === 0) return 'J0';
  return offset > 0 ? `J+${offset}` : `J${offset}`;
}

let temporaryKey = 0;
const newRow = (order) => ({
  key: `new-${(temporaryKey += 1)}`,
  id: undefined,
  titleFr: '',
  detailFr: '',
  dayOffset: 0,
  dayLabelFr: 'J0',
  ownerDepartment: 'HR',
  phase: 'DAY_ONE',
  isRecommended: false,
  order,
});

/**
 * /app/hr/templates/[id] (route guide §2.3, CORE).
 * "Template builder: task sequence — name, owner department (HR/IT/HSE/QUALITY/MANAGER/
 * EMPLOYEE), day offset (D-7, D0, D+15…), mandatory flag, reorder."
 *
 * The whole sequence is edited locally and saved in one PATCH /templates/:id/milestones.
 * Sending the full ordered list rather than per-row saves is what makes reordering
 * expressible: `order` only means something relative to its siblings, so a partial update
 * would let two steps claim the same rank. The server writes one audit row for the edit.
 *
 * "Mandatory" maps to the schema's `isRecommended` inverted — a milestone that is *not*
 * merely recommended is required. The label says "obligatoire" and the checkbox writes
 * `isRecommended: !checked`, so the stored meaning and the shown meaning stay aligned.
 *
 * Reorder is by move-up/move-down buttons rather than drag-and-drop: they are keyboard-
 * reachable and screen-reader-announceable, which a bare pointer drag is not.
 */
export default function HrTemplateBuilderPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const [template, setTemplate] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const reduce = useReducedMotion();

  const canEdit = can(user, 'update', 'onboarding_template');

  const load = useCallback(async () => {
    try {
      const { data } = await templatesApi.get(id);
      setTemplate(data);
      setRows(
        data.milestones.map((milestone, index) => ({
          key: milestone.id,
          id: milestone.id,
          titleFr: milestone.titleFr,
          detailFr: milestone.detailFr ?? '',
          dayOffset: milestone.dayOffset,
          dayLabelFr: milestone.dayLabelFr,
          ownerDepartment: milestone.ownerDepartment ?? 'HR',
          phase: milestone.phase ?? 'DAY_ONE',
          isRecommended: milestone.isRecommended,
          order: milestone.order ?? index,
        })),
      );
      setDirty(false);
      setError(null);
    } catch {
      setError(t('hr.templateBuilder.notFound'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  function update(index, patch) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // The day label follows the offset unless the editor typed a label of their own.
        if (patch.dayOffset !== undefined) next.dayLabelFr = dayLabelFor(patch.dayOffset);
        return next;
      }),
    );
    setDirty(true);
    setSaved(false);
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, i) => ({ ...row, order: i }));
    });
    setDirty(true);
    setSaved(false);
  }

  function addRow() {
    setRows((current) => [...current, newRow(current.length)]);
    setDirty(true);
    setSaved(false);
  }

  function removeRow(index) {
    setRows((current) => current.filter((_, i) => i !== index).map((row, i) => ({ ...row, order: i })));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await templatesApi.saveMilestones(
        id,
        rows.map((row, index) => ({
          ...(row.id ? { id: row.id } : {}),
          titleFr: row.titleFr,
          detailFr: row.detailFr,
          dayOffset: Number(row.dayOffset),
          dayLabelFr: row.dayLabelFr,
          ownerDepartment: row.ownerDepartment || null,
          phase: row.phase || null,
          isRecommended: row.isRecommended,
          order: index,
        })),
      );
      setSaved(true);
      await load();
    } catch (err) {
      setSaveError(err.body?.message ?? t('hr.templateBuilder.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading label={t('hr.templateBuilder.loading')} />;
  if (error) return <PageError message={error} />;
  if (!template) return null;

  return (
    <div>
      <Link to="/app/hr/templates" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        {t('hr.templateBuilder.back')}
      </Link>

      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={template.titleFr}
        subtitle={
          template.position
            ? t('hr.templateBuilder.profileSubtitle', { profile: template.position.titleFr, steps: rows.length, journeys: template.instanceCount })
            : t('hr.templateBuilder.genericSubtitle', { steps: rows.length, journeys: template.instanceCount })
        }
        actions={
          canEdit ? (
            <>
              <button
                type="button"
                onClick={addRow}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {t('hr.templateBuilder.addStep')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
              >
                {saving ? t('hr.templateBuilder.saving') : t('hr.templateBuilder.saveSequence')}
              </button>
            </>
          ) : null
        }
      />

      {!canEdit && (
        <div className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          {t('hr.templateBuilder.readOnlyNotice')} (<code>onboarding_template:update</code>).
        </div>
      )}

      <AnimatePresence>
        {saveError && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-app border border-status-red/30 bg-status-red/5 p-3 text-sm text-status-red"
          >
            {saveError}
          </motion.p>
        )}
        {saved && !dirty && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-app border border-status-green/30 bg-status-green/5 p-3 text-sm text-status-green"
          >
            {t('hr.templateBuilder.saved')}
          </motion.p>
        )}
        {dirty && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-app border border-status-amber/30 bg-status-amber/5 p-3 text-sm text-status-amber"
          >
            {t('hr.templateBuilder.unsaved')}
          </motion.p>
        )}
      </AnimatePresence>

      {rows.length === 0 ? (
        <EmptyState
          title={t('hr.templateBuilder.emptyTitle')}
          detail={
            canEdit
              ? t('hr.templateBuilder.emptyEditable')
              : t('hr.templateBuilder.emptyReadOnly')
          }
          muted
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row, index) => (
              <motion.div
                key={row.key}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`${CARD} p-4`}
              >
                <div className="flex gap-4">
                  <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                    <span className="font-mono text-xs text-text-dim">{index + 1}</span>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label={t('hr.templateBuilder.moveUp', { number: index + 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs text-text-dim transition-colors hover:border-red-brand hover:text-red-brand disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label={t('hr.templateBuilder.moveDown', { number: index + 1 })}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs text-text-dim transition-colors hover:border-red-brand hover:text-red-brand disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-dim">
                          {t('hr.templateBuilder.fields.stepTitle')}
                        </label>
                        <input
                          value={row.titleFr}
                          disabled={!canEdit}
                          onChange={(e) => update(index, { titleFr: e.target.value })}
                          className={`${fieldClass} disabled:opacity-70`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-dim">
                          {t('hr.templateBuilder.fields.offset')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={-90}
                            max={365}
                            value={row.dayOffset}
                            disabled={!canEdit}
                            onChange={(e) => update(index, { dayOffset: Number(e.target.value) })}
                            className={`${fieldClass} disabled:opacity-70`}
                          />
                          <span className="shrink-0 rounded-full bg-red-brand/10 px-2 py-0.5 font-mono text-xs text-red-brand">
                            {row.dayLabelFr}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-dim">
                          {t('hr.templateBuilder.fields.department')}
                        </label>
                        <select
                          value={row.ownerDepartment}
                          disabled={!canEdit}
                          onChange={(e) => update(index, { ownerDepartment: e.target.value })}
                          className={`${fieldClass} disabled:opacity-70`}
                        >
                          {DEPARTMENTS.map((department) => (
                            <option key={department.value} value={department.value}>
                              {t(`hr.templateBuilder.departments.${department.value}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-dim">
                        {t('hr.templateBuilder.fields.description')}
                      </label>
                      <textarea
                        rows={2}
                        value={row.detailFr}
                        disabled={!canEdit}
                        onChange={(e) => update(index, { detailFr: e.target.value })}
                        className={`${fieldClass} disabled:opacity-70`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-text-dim">{t('hr.templateBuilder.fields.phase')}</label>
                        <select
                          value={row.phase}
                          disabled={!canEdit}
                          onChange={(e) => update(index, { phase: e.target.value })}
                          className="rounded-app border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-red-brand disabled:opacity-70"
                        >
                          {PHASES.map((phase) => (
                            <option key={phase.value} value={phase.value}>
                              {t(`hr.templateBuilder.phases.${phase.value}`)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={!row.isRecommended}
                          disabled={!canEdit}
                          onChange={(e) => update(index, { isRecommended: !e.target.checked })}
                          className="accent-[var(--color-red-brand)]"
                        />
                        {t('hr.templateBuilder.fields.mandatory')}
                      </label>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="ml-auto text-xs text-status-red hover:underline"
                        >
                          {t('hr.templateBuilder.remove')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {rows.length > 0 && template.instanceCount > 0 && (
        <p className="mt-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          {t('hr.templateBuilder.existingJourneys', { count: template.instanceCount })}
        </p>
      )}
    </div>
  );
}
