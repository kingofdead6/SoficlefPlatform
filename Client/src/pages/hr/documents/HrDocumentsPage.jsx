import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { documentsApi } from '../../../api/documents.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';
import { staggerContainer, staggerItem, rowVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const AVAILABILITY_LABELS = {
  AVAILABLE: { labelFr: 'Publié', className: 'bg-status-green/10 text-status-green' },
  PENDING: { labelFr: 'En préparation', className: 'bg-status-amber/10 text-status-amber' },
};

/**
 * /app/hr/documents (route guide §2.3, SITE).
 * "Document library: upload/version/categorize; track acknowledgments."
 *
 * Upload is real: POST /documents/:id/upload streams the file to Cloudinary through the
 * existing endpoint and flips the document to AVAILABLE. The page reads `storageConfigured`
 * from the list response and says plainly when no storage credentials are configured, rather
 * than offering an upload button that would fail.
 *
 * DEVIATION — "version": `Document` in prisma/schema.prisma has no version chain (no
 * `version`, no `supersededBy`); replacing the file replaces it, and the audit log records
 * each `document.uploaded` with the previous file name. Rather than fake a version list, the
 * page names the replacement behaviour and the audit trail that does record it.
 *
 * "Categorize" maps to the `availability` state and the `order` the library is sorted by,
 * which are the only classification fields the model actually has.
 */
export default function HrDocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: '', titleFr: '', detailFr: '', order: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [notice, setNotice] = useState(null);
  /** The document currently being published, plus the audience chosen for it. */
  const [publishing, setPublishing] = useState(null);
  const [audience, setAudience] = useState({ visibility: 'ALL', departmentsFr: [] });
  const [departments, setDepartments] = useState([]);
  const fileInputRef = useRef(null);
  const pendingUploadId = useRef(null);
  const reduce = useReducedMotion();

  const canCreate = can(user, 'create', 'document');
  const canUpdate = can(user, 'update', 'document');

  /*
   * Publishing is gated on `document:create`, not `document:update`: HR holds the former
   * and not the latter (see domain/auth/permissions.js), and publishing to a department is
   * an HR action by design. Gating this control on canUpdate would have hidden it from the
   * only role that needs it.
   */
  const canPublish = canCreate;

  const load = useCallback(async () => {
    try {
      const response = await documentsApi.list();
      setDocuments(response.data);
      setStorageConfigured(response.storageConfigured !== false);
      setError(null);
    } catch {
      setError('Impossible de charger la bibliothèque documentaire.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canPublish) return;
    documentsApi
      .departments()
      .then((res) => setDepartments(res.data ?? []))
      .catch(() => setDepartments([]));
  }, [canPublish]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter(
      (doc) =>
        doc.titleFr.toLowerCase().includes(term) ||
        (doc.detailFr ?? '').toLowerCase().includes(term) ||
        doc.slug.toLowerCase().includes(term),
    );
  }, [documents, search]);

  const stats = useMemo(
    () => ({
      total: documents.length,
      published: documents.filter((doc) => doc.availability === 'AVAILABLE').length,
      acknowledgements: documents.reduce((sum, doc) => sum + (doc._count?.acknowledgements ?? 0), 0),
    }),
    [documents],
  );

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await documentsApi.create({
        slug: form.slug,
        titleFr: form.titleFr,
        detailFr: form.detailFr || undefined,
        availability: 'PENDING',
        order: Number(form.order) || 0,
      });
      setForm({ slug: '', titleFr: '', detailFr: '', order: 0 });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? 'La création du document a échoué.');
    } finally {
      setSubmitting(false);
    }
  }

  function pickFile(documentId) {
    pendingUploadId.current = documentId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    const documentId = pendingUploadId.current;
    event.target.value = '';
    if (!file || !documentId) return;

    setUploadingId(documentId);
    setNotice(null);
    try {
      await documentsApi.upload(documentId, file);
      setNotice(`« ${file.name} » a été téléversé et le document est publié.`);
      await load();
    } catch (err) {
      setNotice(err.body?.message ?? 'Le téléversement a échoué.');
    } finally {
      setUploadingId(null);
      pendingUploadId.current = null;
    }
  }

  /**
   * Unpublishing needs no audience, so it stays a one-click toggle. Publishing opens the
   * dialog instead: "accepted" and "who receives it" are one decision, and asking after the
   * fact would leave a window where a document is live with the wrong audience.
   */
  async function toggleAvailability(doc) {
    if (doc.availability !== 'AVAILABLE') {
      setAudience({
        visibility: doc.visibility ?? 'ALL',
        departmentsFr: Array.isArray(doc.departmentsFr) ? doc.departmentsFr : [],
      });
      setPublishing(doc);
      return;
    }

    try {
      await documentsApi.update(doc.id, { availability: 'PENDING' });
      await load();
    } catch (err) {
      setNotice(err.body?.message ?? 'La mise à jour a échoué.');
    }
  }

  async function confirmPublish() {
    if (!publishing) return;
    if (audience.visibility === 'DEPARTMENTS' && audience.departmentsFr.length === 0) return;

    try {
      await documentsApi.publish(publishing.id, audience);
      setPublishing(null);
      await load();
    } catch (err) {
      setNotice(err.body?.message ?? 'La publication a échoué.');
    }
  }

  function toggleDepartment(name) {
    setAudience((current) => ({
      ...current,
      departmentsFr: current.departmentsFr.includes(name)
        ? current.departmentsFr.filter((entry) => entry !== name)
        : [...current.departmentsFr, name],
    }));
  }

  if (loading) return <PageLoading label="Chargement de la bibliothèque…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Bibliothèque documentaire"
        subtitle="Publier les documents de référence et suivre leurs accusés de lecture."
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((open) => !open)}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {showForm ? 'Annuler' : 'Nouveau document'}
            </button>
          ) : null
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      {!storageConfigured && (
        <div className="mb-6 rounded-app border border-dashed border-status-amber/40 bg-status-amber/5 p-4 text-xs text-status-amber">
          Aucun espace de stockage n’est configuré sur ce serveur : les fiches documentaires peuvent
          être créées et décrites, mais le téléversement de fichiers est indisponible jusqu’à la
          configuration des identifiants Cloudinary.
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
            Documents
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Publiés
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.published} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Accusés de lecture
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.acknowledgements} />
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && canCreate && (
          <motion.form
            onSubmit={handleCreate}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">Nouveau document</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Référence</label>
                  <input
                    required
                    placeholder="reglement-interieur"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text">Titre</label>
                  <input
                    required
                    value={form.titleFr}
                    onChange={(e) => setForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Description</label>
                <textarea
                  rows={2}
                  value={form.detailFr}
                  onChange={(e) => setForm((f) => ({ ...f, detailFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-sm font-medium text-text">Ordre</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                  className={fieldClass}
                />
              </div>

              {formError && <p className="text-sm text-status-red">{formError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {submitting ? 'Création…' : 'Créer la fiche'}
                </button>
              </div>
              <p className="text-xs text-text-dim">
                La fiche est créée « en préparation » ; téléversez ensuite le fichier depuis la liste
                pour la publier.
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-app border border-border bg-surface-2 p-3 text-sm text-text-muted"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <div className={`${CARD} mb-6 p-4`}>
        <input
          type="search"
          placeholder="Rechercher un document…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={fieldClass}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState detail="Aucun document ne correspond à cette recherche." muted />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Fichier</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3 font-medium">Accusés</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer(0.03, 0.15)}
              initial={initialOrNone(reduce)}
              animate="visible"
            >
              {visible.map((doc) => (
                <motion.tr
                  key={doc.id}
                  variants={rowVariants}
                  className="border-b border-border last:border-0 hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{doc.titleFr}</p>
                    <p className="font-mono text-[10px] text-text-dim">{doc.slug}</p>
                    {doc.detailFr && (
                      <p className="max-w-md truncate text-xs text-text-dim">{doc.detailFr}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-brand hover:underline"
                      >
                        {doc.fileName ?? 'Ouvrir'}
                      </a>
                    ) : (
                      <span className="text-text-dim">Aucun fichier</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        AVAILABILITY_LABELS[doc.availability]?.className ?? 'bg-surface-2 text-text-dim'
                      }`}
                    >
                      {AVAILABILITY_LABELS[doc.availability]?.labelFr ?? doc.availability}
                    </span>
                    {/*
                      Audience, named rather than merely flagged: "restricted" tells a
                      publisher nothing they can act on, the department list does.
                    */}
                    {doc.availability === 'AVAILABLE' && (
                      <span className="mt-1 block text-[11px] text-text-dim">
                        {doc.visibility === 'DEPARTMENTS'
                          ? (Array.isArray(doc.departmentsFr) && doc.departmentsFr.length > 0
                              ? doc.departmentsFr.join(', ')
                              : 'aucun département ciblé')
                          : 'tout le personnel'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">
                    {doc._count?.acknowledgements ?? 0}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-3">
                      {canUpdate && storageConfigured && (
                        <button
                          type="button"
                          onClick={() => pickFile(doc.id)}
                          disabled={uploadingId === doc.id}
                          className="text-xs text-red-brand hover:underline disabled:opacity-50"
                        >
                          {uploadingId === doc.id
                            ? 'Téléversement…'
                            : doc.storageKey
                              ? 'Remplacer le fichier'
                              : 'Téléverser'}
                        </button>
                      )}
                      {(canUpdate || canPublish) && (
                        <button
                          type="button"
                          onClick={() => toggleAvailability(doc)}
                          className="text-xs text-text-dim hover:text-red-brand hover:underline"
                        >
                          {doc.availability === 'AVAILABLE' ? 'Dépublier' : 'Publier…'}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}

      <p className="mt-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        Le modèle de données ne conserve pas d’historique de versions : téléverser un nouveau fichier
        remplace le précédent. Chaque remplacement est en revanche consigné au journal d’audit
        (<code>document.uploaded</code>), avec le nom du fichier remplacé.
      </p>

      {/*
        Publish dialog. Accepting a document and choosing who receives it is one decision,
        so it is one step: publishing first and asking after would leave the document live
        with the wrong audience in between.
      */}
      <AnimatePresence>
        {publishing && (
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setPublishing(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Publier le document"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className={`${CARD} w-full max-w-lg p-6`}
            >
              <h2 className="font-display text-xl text-red-deep">Publier « {publishing.titleFr} »</h2>
              <p className="mt-1 text-sm text-text-dim">
                Le document deviendra visible dans l’espace des personnes concernées.
              </p>

              <fieldset className="mt-5 space-y-2">
                <legend className="mb-2 text-sm font-medium text-text">Destinataires</legend>

                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience.visibility === 'ALL'}
                    onChange={() => setAudience((c) => ({ ...c, visibility: 'ALL' }))}
                    className="mt-1 accent-[var(--color-red-brand)]"
                  />
                  <span>
                    <span className="block text-text">Tout le personnel</span>
                    <span className="block text-xs text-text-dim">
                      Toute personne pouvant consulter la bibliothèque.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience.visibility === 'DEPARTMENTS'}
                    onChange={() => setAudience((c) => ({ ...c, visibility: 'DEPARTMENTS' }))}
                    className="mt-1 accent-[var(--color-red-brand)]"
                  />
                  <span>
                    <span className="block text-text">Départements ciblés</span>
                    <span className="block text-xs text-text-dim">
                      Seules les personnes rattachées aux départements choisis verront le document.
                    </span>
                  </span>
                </label>
              </fieldset>

              {audience.visibility === 'DEPARTMENTS' && (
                <div className="mt-4 max-h-52 overflow-y-auto rounded-app border border-border p-3">
                  {departments.length === 0 ? (
                    <p className="text-xs text-text-dim">
                      Aucun département n’est renseigné dans l’annuaire : les fiches collaborateurs
                      n’ont ni direction ni service. Renseignez-les avant de cibler une publication.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {departments.map((name) => (
                        <li key={name}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                            <input
                              type="checkbox"
                              checked={audience.departmentsFr.includes(name)}
                              onChange={() => toggleDepartment(name)}
                              className="accent-[var(--color-red-brand)]"
                            />
                            {name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="mt-4 text-xs text-text-dim">
                {audience.visibility === 'DEPARTMENTS'
                  ? audience.departmentsFr.length > 0
                    ? `Sera visible par les comptes rattachés à : ${audience.departmentsFr.join(', ')}.`
                    : 'Choisissez au moins un département.'
                  : 'Sera visible par l’ensemble du personnel.'}
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPublishing(null)}
                  className="rounded-app border border-border px-3 py-2 text-sm text-text-dim hover:bg-surface-2"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmPublish}
                  disabled={
                    audience.visibility === 'DEPARTMENTS' && audience.departmentsFr.length === 0
                  }
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                >
                  Publier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
