import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import { usersApi } from '../../../api/users.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const KIND_LABELS = { ERASURE: 'Effacement', EXPORT: 'Export', CONSENT: 'Consentement' };
const STATUS_LABELS = { OPEN: 'Ouverte', DONE: 'Traitée', REJECTED: 'Rejetée' };
const STATUS_STYLE = {
  OPEN: 'bg-status-amber/10 text-status-amber',
  DONE: 'bg-status-green/10 text-status-green',
  REJECTED: 'bg-surface-2 text-text-dim',
};

/**
 * /admin/gdpr (route guide §2.4, LATER).
 * "Consent register, retention rules, erasure and export requests."
 *
 * Two halves with different standing, kept visibly apart:
 *
 *  - **Registre** — real rows in `gdpr_request`. Logging a request, annotating it and
 *    closing it are genuine audited mutations, and that is exactly what a register is.
 *  - **Données détenues** — the live inventory from GET /admin/gdpr, with the honest note
 *    that most categories cannot simply be deleted (anonymisation, legal retention).
 *
 * Fulfilment is *not* automated: closing a request records that a human did the work
 * elsewhere. The server reports `erasureAutomated: false` and the page says so, because a
 * button labelled "effacer" that only flips a status would be the dangerous version.
 */
export default function GdprPage() {
  const [report, setReport] = useState(null);
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState({ kinds: [], statuses: [], erasureAutomated: false });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: 'EXPORT', subjectUserId: '', noteFr: '' });
  const [statusFilter, setStatusFilter] = useState('');
  const reduce = useReducedMotion();

  async function load() {
    try {
      const [reportRes, requestsRes] = await Promise.all([adminApi.gdpr(), adminApi.gdprRequests()]);
      setReport(reportRes.data ?? reportRes);
      setRequests(requestsRes.data ?? []);
      setMeta({
        kinds: requestsRes.kinds ?? ['ERASURE', 'EXPORT', 'CONSENT'],
        statuses: requestsRes.statuses ?? ['OPEN', 'DONE', 'REJECTED'],
        erasureAutomated: Boolean(requestsRes.erasureAutomated),
      });
    } catch {
      setError('Impossible de charger le registre RGPD.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // The subject picker is a convenience; if the caller cannot list accounts the form
    // still works with no subject attached, so a failure here is not surfaced.
    usersApi
      .list()
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const visible = useMemo(
    () => (statusFilter ? requests.filter((row) => row.status === statusFilter) : requests),
    [requests, statusFilter],
  );

  async function createRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.createGdprRequest({
        kind: form.kind,
        subjectUserId: form.subjectUserId || null,
        noteFr: form.noteFr || null,
      });
      setForm({ kind: 'EXPORT', subjectUserId: '', noteFr: '' });
      setShowForm(false);
      await load();
    } catch {
      setError("L'enregistrement de la demande a échoué.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(request, status) {
    try {
      await adminApi.updateGdprRequest(request.id, { status });
      await load();
    } catch {
      setError('La mise à jour de la demande a échoué.');
    }
  }

  if (loading) return <PageLoading label="Chargement du registre…" />;
  if (error && !report) return <PageError message={error} />;

  const openCount = requests.filter((row) => row.status === 'OPEN').length;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="RGPD"
        subtitle="Registre des demandes, et inventaire des données détenues par la plateforme."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
          >
            {showForm ? 'Annuler' : 'Enregistrer une demande'}
          </button>
        }
      />

      {!meta.erasureAutomated && (
        <div className="mb-8 rounded-app border border-red-brand/40 bg-red-brand/5 p-4 text-sm text-text-dim">
          <p className="font-medium text-text">Le traitement n'est pas automatisé.</p>
          <p className="mt-1">
            Ce registre trace les demandes et leur suite. Clôturer une demande enregistre
            qu'une personne a fait le travail ailleurs — aucun effacement ni export n'est
            déclenché depuis cet écran. Plusieurs catégories ci-dessous ne peuvent d'ailleurs
            pas être simplement supprimées.
          </p>
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: 'Demandes ouvertes', value: openCount, tone: openCount > 0 ? 'amber' : undefined },
          { label: 'Total des demandes', value: requests.length },
          { label: 'Catégories de données', value: report?.categories?.length ?? 0 },
          {
            label: 'Comptes concernés',
            value: report?.categories?.[0]?.count ?? 0,
          },
        ].map((tile) => (
          <motion.div key={tile.label} variants={staggerItem} className={`${CARD} p-5`}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{tile.label}</p>
            <p className={`font-display text-3xl ${tile.tone === 'amber' ? 'text-status-amber' : 'text-red-deep'}`}>
              <CountUp value={tile.value} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={createRequest}
            className="mb-8 overflow-hidden"
          >
            <div className={`${CARD} grid gap-3 p-5 sm:grid-cols-3`}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">Type</span>
                <select
                  value={form.kind}
                  onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
                  className={`${field} w-full`}
                >
                  {meta.kinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind] ?? kind}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">Personne concernée</span>
                <select
                  value={form.subjectUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, subjectUserId: e.target.value }))}
                  className={`${field} w-full`}
                >
                  <option value="">Non rattachée à un compte</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-3">
                <span className="mb-1 block text-sm font-medium text-text">Note</span>
                <textarea
                  rows={2}
                  value={form.noteFr}
                  onChange={(e) => setForm((prev) => ({ ...prev, noteFr: e.target.value }))}
                  placeholder="Origine de la demande, pièces reçues, suite donnée…"
                  className={`${field} w-full`}
                />
              </label>

              <div className="flex justify-end sm:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Registre des demandes ({visible.length})</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={field}>
            <option value="">Tous les états</option>
            {meta.statuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] ?? status}
              </option>
            ))}
          </select>
        </div>

        {visible.length === 0 ? (
          <EmptyState detail="Aucune demande enregistrée." />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Personne</th>
                  <th className="px-4 py-3 font-medium">Reçue le</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">État</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
                {visible.map((request) => (
                  <motion.tr
                    key={request.id}
                    variants={staggerItem}
                    className="border-b border-border last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 text-text">{KIND_LABELS[request.kind] ?? request.kind}</td>
                    <td className="px-4 py-3 text-text-dim">
                      {request.subject?.displayName ?? 'Non rattachée'}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {new Date(request.requestedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-text-dim">{request.noteFr ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLE[request.status] ?? 'bg-surface-2 text-text-dim'
                        }`}
                      >
                        {STATUS_LABELS[request.status] ?? request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {request.status === 'OPEN' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(request, 'DONE')}
                            className="mr-3 text-xs font-medium text-red-brand hover:underline"
                          >
                            Clôturer
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(request, 'REJECTED')}
                            className="text-xs font-medium text-text-dim hover:underline"
                          >
                            Rejeter
                          </button>
                        </>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.08 }}
      >
        <h2 className="mb-1 font-display text-xl text-text">Données détenues</h2>
        <p className="mb-4 max-w-2xl text-sm text-text-dim">
          Ce que la plateforme conserve, et ce qu'un effacement impliquerait réellement pour
          chaque catégorie.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {(report?.categories ?? []).map((category) => (
            <div key={category.titleFr} className={`${CARD} p-4`}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-text">{category.titleFr}</p>
                <span className="font-mono text-xs text-text-dim">{category.count}</span>
              </div>
              <p className="text-sm text-text-dim">{category.holdsFr}</p>
              <p className="mt-2 border-t border-border pt-2 text-xs text-text-dim">
                <span className="font-medium text-text-muted">Effacement : </span>
                {category.erasureFr}
              </p>
            </div>
          ))}
          {(report?.categories ?? []).length === 0 && (
            <EmptyState detail="Inventaire indisponible." muted />
          )}
        </div>
      </motion.section>

      {error && <p className="mt-4 text-sm text-status-red">{error}</p>}
    </div>
  );
}
