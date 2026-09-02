import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { rolesApi, usersApi } from '../../../api/users.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  HR: 'DRH / RH',
  MANAGER: 'Manager',
  EMPLOYEE: 'Collaborateur',
};

const STATUS_LABELS = { ACTIVE: 'Actif', SUSPENDED: 'Suspendu', DISABLED: 'Désactivé' };
const STATUS_PILL = {
  ACTIVE: 'bg-status-green/10 text-status-green',
  SUSPENDED: 'bg-status-amber/10 text-status-amber',
  DISABLED: 'bg-status-red/10 text-status-red',
};

const EMPTY_CREATE = { email: '', displayName: '', phone: '', password: '', roleCode: '' };

/**
 * Parses the bulk-import textarea. One account per line, semicolon-separated:
 *
 *     email ; nom affiché ; téléphone ; rôle
 *
 * Parsing happens here rather than on the server because the administrator needs to see
 * what the file was understood to mean *before* committing it — the server's own validation
 * then runs again on the parsed rows, since a client-side parse is a convenience, never a
 * trust boundary.
 */
function parseImport(text) {
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
        problems.push(`Ligne ${index + 1} : e-mail manquant ou invalide.`);
        return;
      }
      if (!displayName || displayName.length < 2) {
        problems.push(`Ligne ${index + 1} : nom affiché manquant.`);
        return;
      }
      if (roleCode && !ROLE_LABELS[roleCode.toUpperCase()]) {
        problems.push(`Ligne ${index + 1} : rôle « ${roleCode} » inconnu.`);
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
      setError('Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const parsedImport = useMemo(() => parseImport(importText), [importText]);

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
            text: 'Le compte a été créé, mais le rôle n’a pas pu être attribué. Utilisez « Attribuer un rôle » ci-dessous.',
          });
        }
      }

      setCreateForm(EMPTY_CREATE);
      setPanel(null);
      await load();
      setNotice((current) => current ?? { tone: 'ok', text: 'Compte créé.' });
    } catch (err) {
      setCreateError(err.body?.message ?? 'La création du compte a échoué.');
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
      setImportError(err.body?.message ?? 'L’import a échoué : aucun compte n’a été créé.');
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
      setNotice({ tone: 'ok', text: 'Rôle attribué.' });
    } catch (err) {
      setGrantError(
        err.body?.error === 'self_assignment_refused'
          ? 'Vous ne pouvez pas vous attribuer un rôle à vous-même.'
          : err.body?.message ?? 'L’attribution du rôle a échoué.',
      );
    } finally {
      setGranting(false);
    }
  }

  async function handleStatus(user) {
    const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (
      next === 'SUSPENDED' &&
      !window.confirm(
        `Suspendre le compte de ${user.displayName} ? Ses sessions ouvertes seront fermées immédiatement.`,
      )
    ) {
      return;
    }
    try {
      await usersApi.setStatus(user.id, next);
      await load();
      setNotice({
        tone: 'ok',
        text: next === 'ACTIVE' ? 'Compte réactivé.' : 'Compte suspendu et sessions fermées.',
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? 'Le changement de statut a échoué.' });
    }
  }

  async function handleResetAccess(user) {
    if (
      !window.confirm(
        `Réinitialiser les accès de ${user.displayName} ? Toutes ses sessions seront révoquées ; son mot de passe reste inchangé.`,
      )
    ) {
      return;
    }
    try {
      const { revokedSessions } = await usersApi.resetAccess(user.id);
      setNotice({
        tone: 'ok',
        text: `${revokedSessions} session(s) révoquée(s). ${user.displayName} devra se reconnecter.`,
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? 'La réinitialisation a échoué.' });
    }
  }

  if (loading) return <PageLoading label="Chargement des comptes…" />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="Comptes"
        subtitle="Créer, attribuer, suspendre et réinitialiser les accès des comptes de la plateforme."
        actions={
          <>
            <Link
              to="/admin/users/provisioning"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              File de provisionnement
            </Link>
            <button
              type="button"
              onClick={() => togglePanel('import')}
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Import en masse
            </button>
            <button
              type="button"
              onClick={() => togglePanel('create')}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              Nouveau compte
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
        <Tile label="Comptes" value={stats.total} />
        <Tile label="Actifs" value={stats.active} />
        <Tile label="Suspendus" value={stats.suspended} tone={stats.suspended > 0 ? 'red' : undefined} />
        <Tile label="Sans rôle" value={stats.withoutRole} tone={stats.withoutRole > 0 ? 'red' : undefined} />
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
              <h2 className="font-display text-lg text-text">Créer un compte</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled label="E-mail professionnel">
                  <input
                    required
                    type="email"
                    placeholder="prenom.nom@soficlef.dz"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label="Nom affiché">
                  <input
                    required
                    minLength={2}
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label="Téléphone" hint="Facultatif.">
                  <input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled
                  label="Mot de passe provisoire"
                  hint="Transmis de la main à la main : sans relais SMTP, la plateforme ne peut pas l’envoyer."
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

              <Labelled label="Rôle plateforme" hint="Attribué en portée globale ; affinez la portée ci-dessous si besoin.">
                <select
                  value={createForm.roleCode}
                  onChange={(e) => setCreateForm((f) => ({ ...f, roleCode: e.target.value }))}
                  className={FIELD}
                >
                  <option value="">Aucun rôle pour l’instant</option>
                  {Object.entries(ROLE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </Labelled>

              {createError && <p className="text-sm text-status-red">{createError}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  Annuler
                </button>
                <button type="submit" disabled={creating} className={PRIMARY_BUTTON}>
                  {creating ? 'Création…' : 'Créer le compte'}
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
              <h2 className="font-display text-lg text-text">Import en masse</h2>
              <p className="text-sm text-text-dim">
                Une ligne par compte, séparée par des points-virgules :{' '}
                <code className="rounded bg-surface-2 px-1 font-mono text-xs">
                  e-mail ; nom affiché ; téléphone ; rôle
                </code>
                . Le téléphone et le rôle sont facultatifs. L’import est atomique : si une
                seule ligne est refusée, aucun compte n’est créé.
              </p>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'amina.belkacem@soficlef.dz ; Amina Belkacem ; 0550 00 00 00 ; MANAGER\nkarim.saidi@soficlef.dz ; Karim Saïdi ; ; EMPLOYEE'}
                className={`${FIELD} font-mono text-xs`}
              />

              <Labelled
                label="Mot de passe provisoire commun"
                hint="Le même pour tout le lot ; chaque personne devra le changer. Aucune notification n’est envoyée."
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
                  {parsedImport.rows.length} ligne(s) reconnue(s)
                  {parsedImport.problems.length > 0
                    ? ` · ${parsedImport.problems.length} à corriger`
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
                  <p className="font-medium">{importResult.createdCount} compte(s) créé(s).</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {importResult.created.map((row) => (
                      <li key={row.id}>
                        {row.displayName} — {row.email}
                        {row.roleRequested && !row.roleGranted
                          ? ` (rôle ${row.roleRequested} non attribué : référentiel des rôles indisponible)`
                          : row.roleGranted
                            ? ` (${ROLE_LABELS[row.roleGranted] ?? row.roleGranted})`
                            : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={importing || parsedImport.rows.length === 0 || parsedImport.problems.length > 0}
                  className={PRIMARY_BUTTON}
                >
                  {importing ? 'Import…' : `Importer ${parsedImport.rows.length} compte(s)`}
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
              <h2 className="font-display text-lg text-text">Attribuer un rôle</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Labelled label="Compte">
                  <select
                    required
                    value={grant.userId}
                    onChange={(e) => setGrant((g) => ({ ...g, userId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">Choisir…</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label="Rôle">
                  <select
                    value={grant.roleCode}
                    onChange={(e) => setGrant((g) => ({ ...g, roleCode: e.target.value }))}
                    className={FIELD}
                  >
                    {Object.entries(ROLE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label="Portée">
                  <select
                    value={grant.organizationUnitId}
                    onChange={(e) => setGrant((g) => ({ ...g, organizationUnitId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">Portée globale</option>
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
                  Annuler
                </button>
                <button type="submit" disabled={granting} className={PRIMARY_BUTTON}>
                  {granting ? 'Attribution…' : 'Attribuer'}
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
          placeholder="Rechercher un nom ou un e-mail…"
          className={`${FIELD} max-w-xs flex-1`}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${FIELD} w-auto`}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => togglePanel('grant')} className={SECONDARY_BUTTON}>
          Attribuer un rôle
        </button>
        <span className="ml-auto text-sm text-text-dim">{visible.length} compte(s)</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Aucun compte ne correspond"
          detail="Ajustez la recherche ou le filtre de statut."
          muted
        />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Compte</th>
                <th className="px-4 py-3 font-medium">Rôles</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Dernière connexion</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                      <span className="text-xs text-status-red">Aucun rôle</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role, index) => (
                          <span
                            key={`${role.code}-${role.unitCode ?? 'global'}-${index}`}
                            className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted"
                          >
                            {ROLE_LABELS[role.code] ?? role.code}
                            {role.unitName ? ` · ${role.unitName}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[user.status]}`}>
                      {STATUS_LABELS[user.status] ?? user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-dim">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => handleResetAccess(user)}
                        className="text-text-dim transition-colors hover:text-red-brand hover:underline"
                      >
                        Réinitialiser l’accès
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
                          {user.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
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
            <p className="text-sm font-medium text-text-muted">Synchronisation Entra ID</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">Indisponible</span>
          </div>
          <p className="mt-1 text-sm text-text-dim">
            Aucun annuaire Entra ID n’est raccordé à ce déploiement : il n’y a pas de
            locataire depuis lequel importer des comptes. Un bouton « Synchroniser » ne
            pourrait ici que ne rien faire, ou inventer des personnes.
          </p>
        </div>
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-muted">Rattacher une identité Entra</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">Indisponible</span>
          </div>
          <p className="mt-1 text-sm text-text-dim">
            Même raison. Les mots de passe sont gérés par la plateforme et vérifiés par
            Argon2 ; l’authentification unique arrivera avec le connecteur, visible sur la
            page Intégrations.
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        « Réinitialiser l’accès » révoque toutes les sessions ouvertes du compte et l’oblige
        à se reconnecter. Aucun nouveau mot de passe n’est généré : sans relais SMTP, la
        plateforme n’aurait aucun moyen de le transmettre, et l’afficher ici reviendrait à
        écrire un identifiant vivant dans un navigateur.
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
