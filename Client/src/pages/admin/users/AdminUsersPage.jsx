import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { rolesApi, usersApi } from '../../../api/users.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const ROLE_CODES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];
const STATUS_CODES = ['ACTIVE', 'SUSPENDED', 'DISABLED'];
const STATUS_PILL = {
  ACTIVE: 'bg-status-green/10 text-status-green',
  SUSPENDED: 'bg-status-amber/10 text-status-amber',
  DISABLED: 'bg-status-red/10 text-status-red',
};

const EMPTY_CREATE = { email: '', displayName: '', phone: '', password: '', roleCode: '' };

/**
 * Parses the bulk-import textarea. One account per line, semicolon-separated:
 *
 *     e-mail ; display name ; phone ; role
 *
 * Parsing happens here rather than on the server because the administrator needs to see
 * what the file was understood to mean *before* committing it — the server's own validation
 * then runs again on the parsed rows, since a client-side parse is a convenience, never a
 * trust boundary.
 */
function parseImport(text, t) {
  const rows = [];
  const problems = [];

  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .forEach((line, index) => {
      const parts = line.split(';').map((part) => part.trim());
      const [email, displayName, phone, roleCode] = parts;

      if (!email || !email.includes('@')) {
        problems.push(t('admin.users.importForm.lineErrors.invalidEmail', { line: index + 1 }));
        return;
      }
      if (!displayName || displayName.length < 2) {
        problems.push(t('admin.users.importForm.lineErrors.missingName', { line: index + 1 }));
        return;
      }
      if (roleCode && !ROLE_CODES.includes(roleCode.toUpperCase())) {
        problems.push(t('admin.users.importForm.lineErrors.unknownRole', { line: index + 1, role: roleCode }));
        return;
      }

      rows.push({
        email,
        displayName,
        phone: phone || null,
        roleCode: roleCode ? roleCode.toUpperCase() : null,
      });
    });

  return { rows, problems };
}

/**
 * /admin/users (route guide §2.4, CORE).
 * "Users: create accounts (manual, Entra sync, bulk import), professional e-mail, phone,
 * platform role, deactivate, reset access, link Entra identity."
 *
 * Three of those five creation paths are real here and two are not, and the page says which
 * is which rather than showing five equal buttons:
 *   - Manual creation, bulk import, role granting, deactivation and access reset all hit
 *     real endpoints and write audited rows.
 *   - Entra ID synchronisation and identity linking are disabled with their reason on the
 *     control itself: this deployment has no tenant to synchronise against, so a "Synchroniser"
 *     button would either do nothing or invent people.
 */
export default function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // 'create' | 'import' | 'grant' | null
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const reduce = useReducedMotion();

  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const [importText, setImportText] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [grant, setGrant] = useState({ userId: '', roleCode: 'EMPLOYEE', organizationUnitId: '' });
  const [grantError, setGrantError] = useState(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, scopesRes] = await Promise.all([usersApi.list(), rolesApi.scopes()]);
      setUsers(usersRes.data);
      setUnits(scopesRes.data);
      setError(null);
    } catch {
      setError(t('admin.users.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === 'ACTIVE').length,
      suspended: users.filter((user) => user.status !== 'ACTIVE').length,
      withoutRole: users.filter((user) => user.roles.length === 0).length,
    }),
    [users],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter && user.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        user.displayName.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
      );
    });
  }, [users, search, statusFilter]);

  const parsedImport = useMemo(() => parseImport(importText, t), [importText, t]);

  function togglePanel(name) {
    setNotice(null);
    setPanel((current) => (current === name ? null : name));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await usersApi.create({
        email: createForm.email,
        password: createForm.password,
        displayName: createForm.displayName,
        phone: createForm.phone || null,
      });

      // The role is a second, separate grant: POST /users creates the account, and
      // assignRole() carries the privilege-escalation guard that account creation must not
      // bypass. Failing here leaves a real account without a role rather than no account.
      if (createForm.roleCode && data?.id) {
        try {
          await usersApi.assignRole(data.id, { roleCode: createForm.roleCode, organizationUnitId: null });
        } catch {
          setNotice({
            tone: 'warn',
            text: t('admin.users.roleAssignFailedFallback'),
          });
        }
      }

      setCreateForm(EMPTY_CREATE);
      setPanel(null);
      await load();
      setNotice((current) => current ?? { tone: 'ok', text: t('admin.users.accountCreated') });
    } catch (err) {
      setCreateError(err.body?.message ?? t('admin.users.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function handleImport(event) {
    event.preventDefault();
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const data = await usersApi.import({ rows: parsedImport.rows, password: importPassword });
      setImportResult(data);
      setImportText('');
      setImportPassword('');
      await load();
    } catch (err) {
      setImportError(err.body?.message ?? t('admin.users.importFailed'));
    } finally {
      setImporting(false);
    }
  }

  async function handleGrant(event) {
    event.preventDefault();
    setGranting(true);
    setGrantError(null);
    try {
      await usersApi.assignRole(grant.userId, {
        roleCode: grant.roleCode,
        organizationUnitId: grant.organizationUnitId || null,
      });
      setGrant({ userId: '', roleCode: 'EMPLOYEE', organizationUnitId: '' });
      setPanel(null);
      await load();
      setNotice({ tone: 'ok', text: t('admin.users.roleGranted') });
    } catch (err) {
      setGrantError(
        err.body?.error === 'self_assignment_refused'
          ? t('admin.users.selfAssignmentRefused')
          : err.body?.message ?? t('admin.users.grantFailed'),
      );
    } finally {
      setGranting(false);
    }
  }

  async function handleStatus(user) {
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (
      next === 'SUSPENDED' &&
      !window.confirm(t('admin.users.confirmSuspend', { name: user.displayName }))
    ) {
      return;
    }
    try {
      await usersApi.setStatus(user.id, next);
      await load();
      setNotice({
        tone: 'ok',
        text: next === 'ACTIVE' ? t('admin.users.accountReactivated') : t('admin.users.accountSuspended'),
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? t('admin.users.statusChangeFailed') });
    }
  }

  async function handleResetAccess(user) {
    if (
      !window.confirm(t('admin.users.confirmResetAccess', { name: user.displayName }))
    ) {
      return;
    }
    try {
      const { revokedSessions } = await usersApi.resetAccess(user.id);
      setNotice({
        tone: 'ok',
        text: t('admin.users.resetAccessResult', { count: revokedSessions, name: user.displayName }),
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? t('admin.users.resetAccessFailed') });
    }
  }

  if (loading) return <PageLoading label={t('admin.users.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('admin.users.eyebrow')}
        title={t('admin.users.title')}
        subtitle={t('admin.users.subtitle')}
        actions={
          <>
            <Link
              to="/admin/users/provisioning"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('admin.users.provisioningLink')}
            </Link>
            <button
              type="button"
              onClick={() => togglePanel('import')}
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('admin.users.bulkImport')}
            </button>
            <button
              type="button"
              onClick={() => togglePanel('create')}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {t('admin.users.newAccount')}
            </button>
          </>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label={t('admin.users.tiles.total')} value={stats.total} />
        <Tile label={t('admin.users.tiles.active')} value={stats.active} />
        <Tile label={t('admin.users.tiles.suspended')} value={stats.suspended} tone={stats.suspended > 0 ? 'red' : undefined} />
        <Tile label={t('admin.users.tiles.withoutRole')} value={stats.withoutRole} tone={stats.withoutRole > 0 ? 'red' : undefined} />
      </motion.div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.p
            key={notice.text}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 overflow-hidden rounded-app border p-3 text-sm ${
              notice.tone === 'warn'
                ? 'border-status-red/30 bg-status-red/5 text-status-red'
                : 'border-status-green/30 bg-status-green/5 text-status-green'
            }`}
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Creation panel */}
      <AnimatePresence initial={false}>
        {panel === 'create' && (
          <Panel reduce={reduce}>
            <form onSubmit={handleCreate} className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('admin.users.createForm.title')}</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled label={t('admin.users.createForm.email')}>
                  <input
                    required
                    type="email"
                    placeholder="prenom.nom@soficlef.dz"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label={t('admin.users.createForm.displayName')}>
                  <input
                    required
                    minLength={2}
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label={t('admin.users.createForm.phone')} hint={t('admin.users.createForm.phoneHint')}>
                  <input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled
                  label={t('admin.users.createForm.password')}
                  hint={t('admin.users.createForm.passwordHint')}
                >
                  <input
                    required
                    minLength={8}
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
              </div>

              <Labelled label={t('admin.users.createForm.role')} hint={t('admin.users.createForm.roleHint')}>
                <select
                  value={createForm.roleCode}
                  onChange={(e) => setCreateForm((f) => ({ ...f, roleCode: e.target.value }))}
                  className={FIELD}
                >
                  <option value="">{t('admin.users.createForm.roleNone')}</option>
                  {ROLE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`admin.users.roles.${code}`)}
                    </option>
                  ))}
                </select>
              </Labelled>

              {createError && <p className="text-sm text-status-red">{createError}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  {t('admin.users.createForm.cancel')}
                </button>
                <button type="submit" disabled={creating} className={PRIMARY_BUTTON}>
                  {creating ? t('admin.users.createForm.creating') : t('admin.users.createForm.create')}
                </button>
              </div>
            </form>
          </Panel>
        )}
      </AnimatePresence>

      {/* Bulk import panel */}
      <AnimatePresence initial={false}>
        {panel === 'import' && (
          <Panel reduce={reduce}>
            <form onSubmit={handleImport} className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('admin.users.importForm.title')}</h2>
              <p className="text-sm text-text-dim">{t('admin.users.importForm.description')}</p>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={t('admin.users.importForm.placeholder')}
                className={`${FIELD} font-mono text-xs`}
              />

              <Labelled
                label={t('admin.users.importForm.sharedPassword')}
                hint={t('admin.users.importForm.sharedPasswordHint')}
              >
                <input
                  required
                  minLength={8}
                  type="text"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className={FIELD}
                />
              </Labelled>

              <div className="rounded-app border border-border bg-surface-2/60 p-3 text-sm">
                <p className="font-medium text-text">
                  {t('admin.users.importForm.recognisedLines', { count: parsedImport.rows.length })}
                  {parsedImport.problems.length > 0
                    ? t('admin.users.importForm.toFix', { count: parsedImport.problems.length })
                    : ''}
                </p>
                {parsedImport.problems.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-status-red">
                    {parsedImport.problems.slice(0, 6).map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                )}
              </div>

              {importError && <p className="text-sm text-status-red">{importError}</p>}

              {importResult && (
                <div className="rounded-app border border-status-green/30 bg-status-green/5 p-3 text-sm text-status-green">
                  <p className="font-medium">
                    {t('admin.users.importForm.createdAccounts', { count: importResult.createdCount })}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {importResult.created.map((row) => (
                      <li key={row.id}>
                        {row.displayName} — {row.email}
                        {row.roleRequested && !row.roleGranted
                          ? t('admin.users.importForm.roleNotGranted', { role: row.roleRequested })
                          : row.roleGranted
                            ? ` (${t(`admin.users.roles.${row.roleGranted}`, row.roleGranted)})`
                            : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  {t('admin.users.importForm.close')}
                </button>
                <button
                  type="submit"
                  disabled={importing || parsedImport.rows.length === 0 || parsedImport.problems.length > 0}
                  className={PRIMARY_BUTTON}
                >
                  {importing ? t('admin.users.importForm.importing') : t('admin.users.importForm.importButton', { count: parsedImport.rows.length })}
                </button>
              </div>
            </form>
          </Panel>
        )}
      </AnimatePresence>

      {/* Role grant panel */}
      <AnimatePresence initial={false}>
        {panel === 'grant' && (
          <Panel reduce={reduce}>
            <form onSubmit={handleGrant} className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('admin.users.grantForm.title')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Labelled label={t('admin.users.grantForm.account')}>
                  <select
                    required
                    value={grant.userId}
                    onChange={(e) => setGrant((g) => ({ ...g, userId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">{t('admin.users.grantForm.accountPlaceholder')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label={t('admin.users.grantForm.role')}>
                  <select
                    value={grant.roleCode}
                    onChange={(e) => setGrant((g) => ({ ...g, roleCode: e.target.value }))}
                    className={FIELD}
                  >
                    {ROLE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {t(`admin.users.roles.${code}`)}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label={t('admin.users.grantForm.scope')}>
                  <select
                    value={grant.organizationUnitId}
                    onChange={(e) => setGrant((g) => ({ ...g, organizationUnitId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">{t('admin.users.grantForm.scopeGlobal')}</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.nameFr}
                      </option>
                    ))}
                  </select>
                </Labelled>
              </div>

              {grantError && <p className="text-sm text-status-red">{grantError}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  {t('admin.users.grantForm.cancel')}
                </button>
                <button type="submit" disabled={granting} className={PRIMARY_BUTTON}>
                  {granting ? t('admin.users.grantForm.granting') : t('admin.users.grantForm.grant')}
                </button>
              </div>
            </form>
          </Panel>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.filters.searchPlaceholder')}
          className={`${FIELD} max-w-xs flex-1`}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${FIELD} w-auto`}
        >
          <option value="">{t('admin.users.filters.allStatuses')}</option>
          {STATUS_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`admin.users.statuses.${code}`)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => togglePanel('grant')} className={SECONDARY_BUTTON}>
          {t('admin.users.filters.grantRole')}
        </button>
        <span className="ml-auto text-sm text-text-dim">{t('admin.users.filters.count', { count: visible.length })}</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={t('admin.users.empty')}
          detail={t('admin.users.emptyDetail')}
          muted
        />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">{t('admin.users.table.account')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.table.roles')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.table.lastLogin')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('admin.users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{user.displayName}</p>
                    <p className="text-xs text-text-dim">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-status-red">{t('admin.users.table.noRole')}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role, index) => (
                          <span
                            key={`${role.code}-${role.unitCode ?? 'global'}-${index}`}
                            className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted"
                          >
                            {t(`admin.users.roles.${role.code}`, role.code)}
                            {role.unitName ? ` · ${role.unitName}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[user.status]}`}>
                      {t(`admin.users.statuses.${user.status}`, user.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(localeOf(i18n)) : t('admin.users.table.never')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => handleResetAccess(user)}
                        className="text-text-dim transition-colors hover:text-red-brand hover:underline"
                      >
                        {t('admin.users.table.resetAccess')}
                      </button>
                      {user.id !== me?.id && (
                        <button
                          type="button"
                          onClick={() => handleStatus(user)}
                          className={
                            user.status === 'ACTIVE'
                              ? 'text-status-red hover:underline'
                              : 'text-red-brand hover:underline'
                          }
                        >
                          {user.status === 'ACTIVE' ? t('admin.users.table.suspend') : t('admin.users.table.reactivate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The two paths that do not exist, stated as controls that say why they are off. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-muted">{t('admin.users.entraSync.title')}</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">{t('admin.users.entraSync.unavailable')}</span>
          </div>
          <p className="mt-1 text-sm text-text-dim">{t('admin.users.entraSync.detail')}</p>
        </div>
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-muted">{t('admin.users.entraLink.title')}</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">{t('admin.users.entraLink.unavailable')}</span>
          </div>
          <p className="mt-1 text-sm text-text-dim">{t('admin.users.entraLink.detail')}</p>
        </div>
      </div>

      <p className="mt-4 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        {t('admin.users.footnote')}
      </p>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:bg-surface-2';

function Panel({ children, reduce }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function Labelled({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

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
