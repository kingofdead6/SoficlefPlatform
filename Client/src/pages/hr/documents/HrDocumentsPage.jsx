import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

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
  AVAILABLE: { key: 'published', className: 'bg-status-green/10 text-status-green' },
  PENDING: { key: 'pending', className: 'bg-status-amber/10 text-status-amber' },
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
  const { t } = useTranslation();
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
      setError(t('hr.documentLibrary.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setFormError(err.body?.message ?? t('hr.documentLibrary.createError'));
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
      setNotice(t('hr.documentLibrary.uploaded', { name: file.name }));
      await load();
    } catch (err) {
      setNotice(err.body?.message ?? t('hr.documentLibrary.uploadError'));
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
      setNotice(err.body?.message ?? t('hr.documentLibrary.updateError'));
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
      setNotice(err.body?.message ?? t('hr.documentLibrary.publishError'));
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

  if (loading) return <PageLoading label={t('hr.pages.documents.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.pages.documents.title')}
        subtitle={t('hr.pages.documents.subtitle')}
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((open) => !open)}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {showForm ? t('hr.documentLibrary.cancel') : t('hr.documentLibrary.newDocument')}
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
          {t('hr.documentLibrary.storageUnavailable')}
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
            {t('hr.documentLibrary.stats.documents')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.documentLibrary.stats.published')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.published} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.documentLibrary.stats.acknowledgements')}
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
              <h2 className="font-display text-lg text-text">{t('hr.documentLibrary.form.title')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.documentLibrary.form.reference')}</label>
                  <input
                    required
                    placeholder="reglement-interieur"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.documentLibrary.form.documentTitle')}</label>
                  <input
                    required
                    value={form.titleFr}
                    onChange={(e) => setForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.documentLibrary.form.description')}</label>
                <textarea
                  rows={2}
                  value={form.detailFr}
                  onChange={(e) => setForm((f) => ({ ...f, detailFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.documentLibrary.form.order')}</label>
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
                  {submitting ? t('hr.documentLibrary.form.creating') : t('hr.documentLibrary.form.create')}
                </button>
              </div>
              <p className="text-xs text-text-dim">
                {t('hr.documentLibrary.form.hint')}
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
          placeholder={t('hr.documentLibrary.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={fieldClass}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState detail={t('hr.documentLibrary.emptySearch')} muted />
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">{t('hr.documentLibrary.table.document')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.documentLibrary.table.file')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.documentLibrary.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('hr.documentLibrary.table.acknowledgements')}</th>
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
                        {doc.fileName ?? t('hr.documentLibrary.open')}
                      </a>
                    ) : (
                      <span className="text-text-dim">{t('hr.documentLibrary.noFile')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        AVAILABILITY_LABELS[doc.availability]?.className ?? 'bg-surface-2 text-text-dim'
                      }`}
                    >
                      {AVAILABILITY_LABELS[doc.availability]
                        ? t(`hr.documentLibrary.status.${AVAILABILITY_LABELS[doc.availability].key}`)
                        : doc.availability}
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
                                : t('hr.documentLibrary.noDepartments'))
                              : t('hr.documentLibrary.allPersonnel')}
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
                            ? t('hr.documentLibrary.uploading')
                            : doc.storageKey
                              ? t('hr.documentLibrary.replaceFile')
                              : t('hr.documentLibrary.upload')}
                        </button>
                      )}
                      {(canUpdate || canPublish) && (
                        <button
                          type="button"
                          onClick={() => toggleAvailability(doc)}
                          className="text-xs text-text-dim hover:text-red-brand hover:underline"
                        >
                          {doc.availability === 'AVAILABLE' ? t('hr.documentLibrary.unpublish') : t('hr.documentLibrary.publish')}
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
        {t('hr.documentLibrary.versionNote')} (<code>document.uploaded</code>).
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
              aria-label={t('hr.documentLibrary.dialog.ariaLabel')}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className={`${CARD} w-full max-w-lg p-6`}
            >
              <h2 className="font-display text-xl text-red-deep">{t('hr.documentLibrary.dialog.title', { title: publishing.titleFr })}</h2>
              <p className="mt-1 text-sm text-text-dim">
                {t('hr.documentLibrary.dialog.subtitle')}
              </p>

              <fieldset className="mt-5 space-y-2">
                <legend className="mb-2 text-sm font-medium text-text">{t('hr.documentLibrary.dialog.audience')}</legend>

                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience.visibility === 'ALL'}
                    onChange={() => setAudience((c) => ({ ...c, visibility: 'ALL' }))}
                    className="mt-1 accent-[var(--color-red-brand)]"
                  />
                  <span>
                    <span className="block text-text">{t('hr.documentLibrary.allPersonnel')}</span>
                    <span className="block text-xs text-text-dim">
                      {t('hr.documentLibrary.dialog.allHint')}
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
                    <span className="block text-text">{t('hr.documentLibrary.dialog.departments')}</span>
                    <span className="block text-xs text-text-dim">
                      {t('hr.documentLibrary.dialog.departmentsHint')}
                    </span>
                  </span>
                </label>
              </fieldset>

              {audience.visibility === 'DEPARTMENTS' && (
                <div className="mt-4 max-h-52 overflow-y-auto rounded-app border border-border p-3">
                  {departments.length === 0 ? (
                    <p className="text-xs text-text-dim">
                      {t('hr.documentLibrary.dialog.noDepartments')}
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
                    ? t('hr.documentLibrary.dialog.selectedDepartments', { departments: audience.departmentsFr.join(', ') })
                    : t('hr.documentLibrary.dialog.chooseDepartment')
                  : t('hr.documentLibrary.dialog.allSummary')}
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPublishing(null)}
                  className="rounded-app border border-border px-3 py-2 text-sm text-text-dim hover:bg-surface-2"
                >
                  {t('hr.documentLibrary.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmPublish}
                  disabled={
                    audience.visibility === 'DEPARTMENTS' && audience.departmentsFr.length === 0
                  }
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                >
                  {t('hr.documentLibrary.publishAction')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
