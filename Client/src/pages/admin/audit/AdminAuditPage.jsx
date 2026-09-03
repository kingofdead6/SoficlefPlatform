import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { auditApi } from '../../../api/audit.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * The audit vocabulary. Mirrors server domain/audit/actions.js: an action absent from this
 * list still renders — under its raw code — rather than being hidden, so a newly added
 * action is visible the day it first fires instead of the day someone remembers to translate
 * it. Labels themselves live under admin.audit.actions.* in the catalogues.
 */
const ACTION_OPTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.session_revoked',
  'auth.password_changed',
  'user.created',
  'user.updated',
  'user.status_changed',
  'user.role_assigned',
  'user.role_revoked',
  'user.role_assignment_denied',
  'user.assigned',
  'user.assignment_ended',
  'role.permission_changed',
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'entity.validated',
  'access.denied',
  'document.downloaded',
  'report.exported',
];

/** Actions that mean something went wrong, for the counter and the row tint. */
const REFUSALS = new Set(['auth.login_failed', 'access.denied', 'user.role_assignment_denied']);

const EMPTY_FILTERS = { search: '', action: '', from: '', to: '', limit: 200 };

/**
 * Escapes one CSV cell. Quotes are doubled and every field is quoted, so a comma or a
 * newline inside an actor's name cannot shift the remaining columns of the row.
 */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * /admin/audit (route guide §2.4, LATER).
 * "Audit log: full connection and action logging; filter by user/date/action; export."
 *
 * The filters are applied by the server (application/admin/directory.js), not in the
 * browser: filtering a page of results client-side would silently narrow only what happened
 * to be fetched, which is the wrong answer to "montre-moi tous les refus de mars".
 *
 * The export is built in the browser from the rows currently displayed, and the button says
 * exactly that — it exports the current selection, not the whole table. A CSV that quietly
 * contained something other than what is on screen would be worse than no export.
 */
export default function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const reduce = useReducedMotion();

  const load = useCallback(async (query) => {
    setRefreshing(true);
    try {
      const { data } = await auditApi.list(query);
      setRows(data ?? []);
      setError(null);
    } catch {
      setError(t('admin.audit.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load(EMPTY_FILTERS);
  }, [load]);

  const stats = useMemo(() => {
    const actors = new Set(rows.map((row) => row.actorLabel).filter(Boolean));
    return {
      entries: rows.length,
      actors: actors.size,
      refusals: rows.filter((row) => REFUSALS.has(row.action)).length,
      distinctActions: new Set(rows.map((row) => row.action)).size,
    };
  }, [rows]);

  function handleSubmit(event) {
    event.preventDefault();
    setApplied(filters);
    load(filters);
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  }

  /**
   * Client-side CSV export via a Blob. UTF-8 with a BOM so Excel opens accented French text
   * correctly rather than as mojibake — the platform's entire UI is in French, and an export
   * that mangles every "é" is not an export.
   */
  function handleExport() {
    const actionLabel = (action) => t(`admin.audit.actions.${action}`, action);
    const header = [
      t('admin.audit.table.date'),
      t('admin.audit.table.actor'),
      t('admin.audit.table.action'),
      t('common.labels.type'),
      t('admin.audit.table.entity'),
      t('common.labels.name'),
      t('admin.audit.table.ip'),
    ];
    const lines = rows.map((row) =>
      [
        new Date(row.createdAt).toLocaleString(localeOf(i18n)),
        row.actorLabel,
        actionLabel(row.action),
        row.action,
        row.entityType,
        row.entityId,
        row.ip,
      ]
        .map(csvCell)
        .join(';'),
    );

    const csv = `﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('admin.audit.exportFilePrefix')}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const filtered =
    applied.search || applied.action || applied.from || applied.to;

  if (loading) return <PageLoading label={t('admin.audit.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('admin.audit.eyebrow')}
        title={t('admin.audit.title')}
        subtitle={t('admin.audit.subtitle')}
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
          >
            {t('admin.audit.exportButton', { count: rows.length })}
          </button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label={t('admin.audit.tiles.entries')} value={stats.entries} />
        <Tile label={t('admin.audit.tiles.actors')} value={stats.actors} />
        <Tile label={t('admin.audit.tiles.actionTypes')} value={stats.distinctActions} />
        <Tile label={t('admin.audit.tiles.refusals')} value={stats.refusals} tone={stats.refusals > 0 ? 'red' : undefined} />
      </motion.div>

      <form onSubmit={handleSubmit} className={`${CARD} mb-6 flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-text-dim">{t('admin.audit.filters.searchLabel')}</label>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder={t('admin.audit.filters.searchPlaceholder')}
            className={`${FIELD} w-full`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-dim">{t('admin.audit.filters.actionLabel')}</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className={FIELD}
          >
            <option value="">{t('admin.audit.filters.allActions')}</option>
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {t(`admin.audit.actions.${action}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-dim">{t('admin.audit.filters.fromLabel')}</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className={FIELD}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-dim">{t('admin.audit.filters.toLabel')}</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className={FIELD}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-dim">{t('admin.audit.filters.limitLabel')}</label>
          <select
            value={filters.limit}
            onChange={(e) => setFilters((f) => ({ ...f, limit: Number(e.target.value) }))}
            className={FIELD}
          >
            {[50, 100, 200, 500].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={refreshing} className={PRIMARY_BUTTON}>
            {refreshing ? t('admin.audit.filters.submitting') : t('admin.audit.filters.submit')}
          </button>
          {filtered && (
            <button type="button" onClick={handleReset} className={SECONDARY_BUTTON}>
              {t('admin.audit.filters.reset')}
            </button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          muted
          title={t('admin.audit.empty')}
          detail={filtered ? t('admin.audit.emptyFiltered') : t('admin.audit.emptyAll')}
        />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                <th className="px-4 py-3 font-medium">{t('admin.audit.table.date')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.table.actor')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.table.action')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.table.entity')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.table.ip')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const refusal = REFUSALS.has(row.action);
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border last:border-0 hover:bg-surface-2/60 ${
                      refusal ? 'bg-status-red/5' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-text-dim">
                      {new Date(row.createdAt).toLocaleString(localeOf(i18n))}
                    </td>
                    <td className="px-4 py-3 text-text">{row.actorLabel ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          refusal ? 'bg-status-red/10 text-status-red' : 'bg-surface-2 text-text-muted'
                        }`}
                      >
                        {t(`admin.audit.actions.${row.action}`, row.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-dim">
                      {row.entityType}
                      {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-dim">{row.ip ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        {t('admin.audit.footnote', { count: rows.length })}
      </p>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:bg-surface-2';

function Tile({ label, value, tone }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}
