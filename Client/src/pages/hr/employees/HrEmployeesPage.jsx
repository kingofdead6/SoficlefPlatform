import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { localeOf } from '../../../lib/formatDate.js';

import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, rowVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const LIFECYCLE_LABELS = {
  PENDING_ASSIGNMENT: 'pending',
  ASSIGNED: 'assigned',
  ONBOARDING: 'onboarding',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

const LIFECYCLE_TONE = {
  PENDING_ASSIGNMENT: 'bg-status-amber/10 text-status-amber',
  ARCHIVED: 'bg-surface-2 text-text-dim',
};

const EMPTY_FILTERS = { search: '', unitCode: '', managerId: '', lifecycleState: '' };

/**
 * /app/hr/employees (route guide §2.3, CORE).
 * "Full directory; search, filter by division/dept/manager/status; export."
 *
 * The filters are applied *server-side* — every change re-queries GET /users?view=directory,
 * which narrows the Prisma query under the caller's own scope. Filtering the fetched array in
 * the browser would have been simpler but wrong: a unit-scoped HR account would then appear
 * to have data it may not read, and the row count would lie.
 *
 * Export writes a CSV from exactly the rows currently shown, via a client-side Blob — there
 * is no server export endpoint for the directory, and inventing one would duplicate a query
 * that already returns the right rows.
 */
export default function HrEmployeesPage() {
  const { t, i18n } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [facets, setFacets] = useState({ units: [], managers: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usersApi.facets();
        setFacets(data);
      } catch {
        // Facets are a convenience: without them the selects are empty but search still works.
      }
    })();
  }, []);

  const load = useCallback(async (activeFilters) => {
    setRefreshing(true);
    try {
      const query = Object.fromEntries(
        Object.entries(activeFilters).filter(([, value]) => value !== ''),
      );
      const { data } = await usersApi.directory(query);
      setEmployees(data);
      setError(null);
    } catch {
      setError(t('hr.employeeDirectory.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => load(filters), 250);
    return () => clearTimeout(handle);
  }, [filters, load]);

  const stats = useMemo(() => {
    const onboarding = employees.filter(
      (row) => row.onboardingPercent !== null && row.onboardingPercent < 100,
    ).length;
    const unassigned = employees.filter((row) => row.lifecycleState === 'PENDING_ASSIGNMENT').length;
    return { total: employees.length, onboarding, unassigned };
  }, [employees]);

  function handleExport() {
    const headers = [
      t('hr.employeeDirectory.export.name'), t('hr.employeeDirectory.export.email'),
      t('hr.employeeDirectory.export.phone'), t('hr.employeeDirectory.export.position'),
      t('hr.employeeDirectory.export.direction'), t('hr.employeeDirectory.export.department'),
      t('hr.employeeDirectory.export.structure'), t('hr.employeeDirectory.export.manager'),
      t('hr.employeeDirectory.export.status'), t('hr.employeeDirectory.export.hireDate'),
      t('hr.employeeDirectory.export.onboarding'),
    ];

    // RFC 4180 quoting: a value containing a quote, comma or newline must be quoted, and
    // embedded quotes doubled — otherwise a job title with a comma silently shifts columns.
    const escape = (value) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = employees.map((row) =>
      [
        row.displayName,
        row.email,
        row.phone,
        row.positionFr ?? row.positionTitleFr,
        row.directionFr,
        row.serviceFr,
        row.unitCode,
        row.managerName,
        t(`hr.employeeDirectory.status.${LIFECYCLE_LABELS[row.lifecycleState]}`, row.lifecycleState),
        row.hireDate ? new Date(row.hireDate).toLocaleDateString(localeOf(i18n)) : '',
        row.onboardingPercent === null ? '' : row.onboardingPercent,
      ]
        .map(escape)
        .join(','),
    );

    // The BOM makes Excel read the file as UTF-8 rather than mangling the accents.
    const csv = `﻿${[headers.join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `collaborateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageLoading label={t('hr.employeeDirectory.loading')} />;
  if (error && employees.length === 0) return <PageError message={error} />;

  const filtersActive = Object.values(filters).some((value) => value !== '');

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.employeeDirectory.title')}
        subtitle={t('hr.employeeDirectory.subtitle')}
        actions={
          <>
            <Link
              to="/app/hr/employees/unassigned"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('hr.employeeDirectory.unassigned')}
            </Link>
            <button
              type="button"
              onClick={handleExport}
              disabled={employees.length === 0}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
            >
              {t('hr.employeeDirectory.exportButton')}
            </button>
          </>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.employeeDirectory.stats.displayed')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.employeeDirectory.stats.onboarding')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.onboarding} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.employeeDirectory.stats.unassigned')}
          </p>
          <p
            className={`font-display text-3xl ${stats.unassigned > 0 ? 'text-status-amber' : 'text-red-deep'}`}
          >
            <CountUp value={stats.unassigned} />
          </p>
        </motion.div>
      </motion.div>

      <div className={`${CARD} mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}>
        <input
          type="search"
          placeholder={t('hr.employeeDirectory.search')}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className={`${fieldClass} lg:col-span-2`}
        />
        <select
          value={filters.unitCode}
          onChange={(e) => setFilters((f) => ({ ...f, unitCode: e.target.value }))}
          className={fieldClass}
        >
          <option value="">{t('hr.employeeDirectory.allStructures')}</option>
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
          <option value="">{t('hr.employeeDirectory.allManagers')}</option>
          {facets.managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.displayName}
            </option>
          ))}
        </select>
        <select
          value={filters.lifecycleState}
          onChange={(e) => setFilters((f) => ({ ...f, lifecycleState: e.target.value }))}
          className={fieldClass}
        >
          <option value="">{t('hr.employeeDirectory.allStatuses')}</option>
          {Object.entries(LIFECYCLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(`hr.employeeDirectory.status.${label}`, label)}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="justify-self-start text-sm text-red-brand hover:underline sm:col-span-2 lg:col-span-5"
          >
            {t('hr.employeeDirectory.reset')}
          </button>
        )}
      </div>

      {employees.length === 0 ? (
        <EmptyState
          title={t('hr.employeeDirectory.emptyTitle')}
          detail={
            filtersActive
              ? t('hr.employeeDirectory.emptyFiltered')
              : t('hr.employeeDirectory.emptyScope')
          }
          muted
        />
      ) : (
        <div className={`overflow-x-auto ${CARD} ${refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.employee')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.position')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.structure')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.manager')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.employeeDirectory.table.onboarding')}</th>
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer(0.03, 0.15)}
              initial={initialOrNone(reduce)}
              animate="visible"
            >
              {employees.map((employee) => (
                <motion.tr
                  key={employee.id}
                  variants={rowVariants}
                  className="border-b border-border last:border-0 hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/app/hr/employees/${employee.id}`}
                      className="font-medium text-text hover:text-red-brand"
                    >
                      {employee.displayName}
                    </Link>
                    <p className="text-xs text-text-dim">{employee.email}</p>
                  </td>
                  <td className="px-4 py-3 text-text-dim">
                    {employee.positionFr ?? employee.positionTitleFr ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-dim">
                    {employee.unitCode ?? employee.directionFr ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-dim">{employee.managerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        LIFECYCLE_TONE[employee.lifecycleState] ?? 'bg-red-brand/10 text-red-brand'
                      }`}
                    >
                      {t(`hr.employeeDirectory.status.${LIFECYCLE_LABELS[employee.lifecycleState]}`, employee.lifecycleState)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {employee.onboardingPercent === null ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${employee.onboardingPercent}%` }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-red-brand"
                          />
                        </div>
                        <span className="font-mono text-xs text-text-dim">
                          {employee.onboardingPercent}%
                        </span>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
