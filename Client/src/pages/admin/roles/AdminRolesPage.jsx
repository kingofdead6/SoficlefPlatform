import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import { rolesApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/** The four action columns of the matrix, in the order §2.4 names them. */
const ACTION_COLUMNS = [
  { action: 'read', labelFr: 'Lire' },
  { action: 'update', labelFr: 'Écrire' },
  { action: 'validate', labelFr: 'Valider' },
  { action: 'delete', labelFr: 'Supprimer' },
];

/**
 * The permission catalogue is `resource:action`; §2.4 asks for a role × module × action
 * matrix. "Module" is the resource, given a French name here so the matrix reads as a
 * business grid rather than as a dump of identifiers. A resource absent from this map still
 * appears — under its raw code — rather than being silently dropped from the grid.
 */
const RESOURCE_LABELS = {
  organization_unit: 'Structures',
  position: 'Postes',
  assignment: 'Affectations',
  job: 'Emplois',
  job_description: 'Fiches de poste',
  competency: 'Compétences',
  assessment: 'Évaluations',
  onboarding_template: 'Modèles d’intégration',
  onboarding_instance: 'Parcours d’intégration',
  onboarding_task: 'Étapes d’intégration',
  remark: 'Remarques',
  kaizen_action: 'Actions Kaizen',
  document: 'Documents',
  report: 'Rapports',
  dashboard: 'Tableaux de bord',
  notification: 'Notifications',
  survey: 'Enquêtes',
  training: 'Formation',
  user: 'Comptes',
  role: 'Rôles',
  audit_log: 'Journal d’audit',
  setting: 'Paramètres',
};

const BUILTIN_LABELS = {
  ADMIN: 'Administrateur',
  HR: 'DRH / RH',
  MANAGER: 'Manager',
  EMPLOYEE: 'Collaborateur',
};

const EMPTY_FORM = { code: '', nameFr: '', descriptionFr: '', permissions: [] };

/**
 * /admin/roles (route guide §2.4, LATER).
 * "RBAC matrix: role × module × action (read/write/validate/delete); custom roles."
 *
 * The page shows two kinds of role and treats them differently on purpose:
 *
 *   - The four **built-in** roles are read-only here. Their permissions live in
 *     domain/auth/permissions.js as code because `can()` resolves them on every single
 *     request; moving them into a table would put a database round-trip inside every
 *     authorization decision. Their matrix is therefore displayed, not edited, and the page
 *     says why rather than showing greyed-out checkboxes with no explanation.
 *   - **Custom** roles are rows in `custom_role` and their matrix is fully editable: every
 *     tick is a real write through mutate(), validated against the permission catalogue so
 *     a role can never be granted a permission the authorization layer would not recognise.
 *
 * The honest limitation, stated on the page: a custom role is declared but not yet
 * *assignable* — POST /users/:id/roles grants one of the four built-in codes, since that is
 * what `can()` reads. Defining the role is the durable half; wiring assignment to it is a
 * change to the authorization layer, not to this screen.
 */
export default function AdminRolesPage() {
  const [builtins, setBuiltins] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('builtin');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const [builtinRes, customRes] = await Promise.all([rolesApi.list(), adminApi.customRoles()]);
      setBuiltins(builtinRes.data ?? []);
      setCustomRoles(customRes.data ?? []);
      setCatalogue(customRes.catalogue ?? []);
      setError(null);
    } catch {
      setError('Impossible de charger les rôles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Resources present in the catalogue, ordered as RESOURCE_LABELS declares them. */
  const resources = useMemo(() => {
    const present = [...new Set(catalogue.map((code) => code.split(':')[0]))];
    const ordered = Object.keys(RESOURCE_LABELS).filter((key) => present.includes(key));
    const extras = present.filter((key) => !RESOURCE_LABELS[key]).sort();
    return [...ordered, ...extras];
  }, [catalogue]);

  const selectedCustom = customRoles.find((role) => role.id === selectedId) ?? null;

  function openCreate() {
    setForm(EMPTY_FORM);
    setSelectedId(null);
    setFormError(null);
    setShowForm(true);
    setTab('custom');
  }

  function openEdit(role) {
    setForm({
      code: role.code,
      nameFr: role.nameFr,
      descriptionFr: role.descriptionFr ?? '',
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
    setSelectedId(role.id);
    setFormError(null);
    setShowForm(true);
  }

  function togglePermission(code) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(code)
        ? current.permissions.filter((entry) => entry !== code)
        : [...current.permissions, code],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (selectedId) {
        await adminApi.updateCustomRole(selectedId, {
          nameFr: form.nameFr,
          descriptionFr: form.descriptionFr || null,
          permissions: form.permissions,
        });
      } else {
        await adminApi.createCustomRole({
          code: form.code.trim().toUpperCase(),
          nameFr: form.nameFr,
          descriptionFr: form.descriptionFr || null,
          permissions: form.permissions,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSelectedId(null);
      await load();
    } catch (err) {
      setFormError(
        err.body?.fieldErrors
          ? Object.values(err.body.fieldErrors).flat().join(' ')
          : err.body?.message ?? 'L’enregistrement du rôle a échoué.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    if (!window.confirm(`Supprimer le rôle « ${role.nameFr} » ?`)) return;
    try {
      await adminApi.deleteCustomRole(role.id);
      if (selectedId === role.id) {
        setSelectedId(null);
        setShowForm(false);
      }
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? 'La suppression a échoué.');
    }
  }

  if (loading) return <PageLoading label="Chargement des rôles…" />;
  if (error) return <PageError message={error} />;

  const totalCustomPermissions = customRoles.reduce(
    (sum, role) => sum + (Array.isArray(role.permissions) ? role.permissions.length : 0),
    0,
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="Rôles et permissions"
        subtitle="La matrice rôle × module × action : ce que chaque profil a le droit de lire, écrire, valider et supprimer."
        actions={
          <button type="button" onClick={showForm ? () => setShowForm(false) : openCreate} className={PRIMARY_BUTTON}>
            {showForm ? 'Annuler' : 'Nouveau rôle personnalisé'}
          </button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label="Rôles intégrés" value={builtins.length} />
        <Tile label="Rôles personnalisés" value={customRoles.length} />
        <Tile label="Permissions du catalogue" value={catalogue.length} />
        <Tile label="Permissions accordées (personnalisés)" value={totalCustomPermissions} />
      </motion.div>

      <div className="mb-6 flex gap-1 border-b border-border">
        <TabButton active={tab === 'builtin'} onClick={() => setTab('builtin')}>
          Rôles intégrés ({builtins.length})
        </TabButton>
        <TabButton active={tab === 'custom'} onClick={() => setTab('custom')}>
          Rôles personnalisés ({customRoles.length})
        </TabButton>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {tab === 'builtin' ? (
          <motion.section
            key="builtin"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <p className="mb-4 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-sm text-text-dim">
              Ces quatre profils sont définis dans le code de la plateforme, pas en base :
              chaque requête vérifie les droits de l’appelant, et interroger une table à ce
              moment-là placerait un aller-retour vers la base au cœur de chaque contrôle
              d’accès. Ils sont donc consultables ici mais modifiables uniquement par
              déploiement. Pour un besoin différent, créez un rôle personnalisé.
            </p>

            <div className="space-y-8">
              {builtins.map((role) => (
                <RoleMatrix
                  key={role.id}
                  titleFr={BUILTIN_LABELS[role.code] ?? role.nameFr}
                  subtitleFr={`${role.userCount} compte(s) · ${role.permissions.length} permission(s)`}
                  description={role.description}
                  resources={resources}
                  granted={new Set(role.permissions)}
                  readOnly
                  reduce={reduce}
                />
              ))}
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="custom"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
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
                      {selectedId ? `Modifier « ${form.nameFr} »` : 'Nouveau rôle personnalisé'}
                    </h2>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-text">Code</label>
                        <input
                          required
                          disabled={Boolean(selectedId)}
                          pattern="[A-Za-z][A-Za-z0-9_]*"
                          placeholder="AUDITEUR_QUALITE"
                          value={form.code}
                          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          className={`${FIELD} font-mono disabled:opacity-60`}
                        />
                        <p className="mt-1 text-xs text-text-dim">
                          {selectedId ? 'Le code d’un rôle existant ne change pas.' : 'Majuscules, sans espace.'}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-text">Intitulé</label>
                        <input
                          required
                          minLength={2}
                          value={form.nameFr}
                          onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))}
                          className={FIELD}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-text">Description</label>
                      <textarea
                        rows={2}
                        value={form.descriptionFr}
                        onChange={(e) => setForm((f) => ({ ...f, descriptionFr: e.target.value }))}
                        className={FIELD}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-text">
                        Permissions ({form.permissions.length} sélectionnée(s))
                      </p>
                      <MatrixGrid
                        resources={resources}
                        catalogue={catalogue}
                        granted={new Set(form.permissions)}
                        onToggle={togglePermission}
                      />
                    </div>

                    {formError && <p className="text-sm text-status-red">{formError}</p>}

                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowForm(false)} className={SECONDARY_BUTTON}>
                        Annuler
                      </button>
                      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
                        {saving ? 'Enregistrement…' : 'Enregistrer le rôle'}
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {customRoles.length === 0 ? (
              <EmptyState
                muted
                title="Aucun rôle personnalisé"
                detail="Les quatre profils intégrés couvrent l’usage courant. Créez un rôle personnalisé pour un besoin qu’aucun d’eux ne décrit — un auditeur externe, par exemple, qui lirait sans jamais écrire."
              />
            ) : (
              <div className="space-y-8">
                {customRoles.map((role) => (
                  <RoleMatrix
                    key={role.id}
                    titleFr={role.nameFr}
                    subtitleFr={`${role.code} · ${(role.permissions ?? []).length} permission(s)`}
                    description={role.descriptionFr}
                    resources={resources}
                    granted={new Set(role.permissions ?? [])}
                    readOnly
                    reduce={reduce}
                    actions={
                      role.isSystem ? (
                        <span className="text-xs text-text-dim">Rôle intégré — non modifiable</span>
                      ) : (
                        <div className="flex gap-3 text-xs">
                          <button type="button" onClick={() => openEdit(role)} className="text-red-brand hover:underline">
                            Modifier
                          </button>
                          <button type="button" onClick={() => handleDelete(role)} className="text-status-red hover:underline">
                            Supprimer
                          </button>
                        </div>
                      )
                    }
                  />
                ))}
              </div>
            )}

            <p className="mt-8 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
              Un rôle personnalisé est enregistré durablement, avec ses permissions validées
              contre le catalogue de la plateforme. Il n’est pas encore *attribuable* à un
              compte : l’attribution passe par les quatre codes intégrés, seuls reconnus par
              la couche d’autorisation. Définir le rôle est la partie durable ; le brancher
              sur l’attribution est une évolution de cette couche, pas de cet écran.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:bg-surface-2';

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'text-red-brand' : 'text-text-dim hover:text-text'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="admin-roles-tab"
          className="absolute inset-x-0 -bottom-px h-0.5 bg-red-brand"
        />
      )}
    </button>
  );
}

/** One role's matrix, wrapped in a card with its heading and optional actions. */
function RoleMatrix({ titleFr, subtitleFr, description, resources, granted, actions, reduce }) {
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`${CARD} p-5`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-text">{titleFr}</h3>
          <p className="text-xs text-text-dim">{subtitleFr}</p>
          {description && <p className="mt-1 max-w-2xl text-sm text-text-dim">{description}</p>}
        </div>
        {actions}
      </div>
      <MatrixGrid resources={resources} granted={granted} />
    </motion.section>
  );
}

/**
 * The grid itself. Read-only when `onToggle` is absent, editable when it is present — one
 * component rather than two, so the displayed matrix and the edited matrix can never drift
 * into showing different things.
 *
 * `catalogue` narrows which cells are even offered when editing: a permission the platform
 * does not define must not be tickable. Read-only mode shows every cell and marks the
 * undefined ones as "—", which is how an administrator sees that "valider" is simply not a
 * concept for, say, notifications.
 */
function MatrixGrid({ resources, granted, catalogue, onToggle }) {
  const editable = typeof onToggle === 'function';
  const defined = catalogue ? new Set(catalogue) : null;

  return (
    <div className="overflow-x-auto rounded-app border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
            <th className="px-4 py-2 font-medium">Module</th>
            {ACTION_COLUMNS.map((column) => (
              <th key={column.action} className="px-3 py-2 text-center font-medium">
                {column.labelFr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-text">{RESOURCE_LABELS[resource] ?? resource}</td>
              {ACTION_COLUMNS.map((column) => {
                const code = `${resource}:${column.action}`;
                const exists = defined ? defined.has(code) : true;
                const on = granted.has(code);

                if (editable) {
                  return (
                    <td key={code} className="px-3 py-2 text-center">
                      {exists ? (
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => onToggle(code)}
                          aria-label={`${RESOURCE_LABELS[resource] ?? resource} — ${column.labelFr}`}
                          className="accent-[var(--color-red-brand)]"
                        />
                      ) : (
                        <span className="text-xs text-text-dim" title="Cette action n’existe pas pour ce module">
                          —
                        </span>
                      )}
                    </td>
                  );
                }

                return (
                  <td key={code} className="px-3 py-2 text-center">
                    <span
                      className={
                        on
                          ? 'inline-block h-2.5 w-2.5 rounded-full bg-red-brand'
                          : 'text-xs text-text-dim'
                      }
                      aria-label={on ? 'Accordé' : 'Non accordé'}
                    >
                      {on ? '' : '—'}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-3xl text-red-deep">
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}
