import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../../api/onboarding.js';
import { personalFilesApi } from '../../../api/personal-files.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';
import { localeOf } from '../../../lib/formatDate.js';
import { OWNER_DEPARTMENTS, STATUS_LABEL_KEYS, STATUS_STYLES, TASK_PHASES } from './taskVocabulary.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-lg text-text';

const NEXT_STATUSES = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
  IN_PROGRESS: ['TODO', 'BLOCKED', 'DONE'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'DONE'],
  DONE: ['TODO', 'IN_PROGRESS', 'BLOCKED'],
  VALIDATED: [],
};

/**
 * The wording a recruit agrees to when they acknowledge a task.
 *
 * Stored verbatim on the row (TaskSignature.statementFr) rather than referenced by key, so
 * the record still says what was agreed even after this string is edited. It is written to
 * be true of what the platform can actually prove: that an authenticated session belonging
 * to this person confirmed, at this instant, having read the task's document.
 *
 * Deliberately *not* translated. The record has to hold the words the person actually read,
 * and the server column is a single French field — showing English while filing French
 * would make the record a claim about words nobody saw. The panel around it is translated;
 * the statement itself is quoted as-is in both languages, which is what a legal record does.
 */
const SIGNATURE_STATEMENT_FR =
  'Je confirme avoir pris connaissance du document associé à cette étape et en accepter le contenu. Je reconnais que cette confirmation est enregistrée avec mon identifiant de compte, la date et l’heure.';

/**
 * /app/me/journey/[taskId] — Task detail (route guide §2.1, CORE).
 * "Description, owner, due date, attachments, e-signature (contract), status history,
 * comment thread."
 *
 * One request fills the page: GET /onboarding/journey/tasks/:milestoneId returns the task,
 * its neighbours, the audit-derived status history, the comment thread and the
 * acknowledgement record if one exists. That endpoint resolves the task through the caller's
 * own journey, so a milestone id belonging to somebody else is a 404 rather than a leak.
 *
 * Two things this page is careful not to overstate:
 *
 *   * The "signature" is an acknowledgement record, not a qualified electronic signature —
 *     no certificate authority or signing key exists in this deployment. The panel says so
 *     in those words, above the button, not in a footnote below it.
 *   * The schema has no link between an onboarding task and a personal file, so
 *     "upload a required document" is wired to the recruit's real outstanding obligations
 *     (GET /personal-files/me) rather than to a per-task attachment that does not exist.
 *     The panel names which piece it is sending and where it will be reviewed.
 */
export default function TaskDetailPage() {
  const { taskId } = useParams();
  const [detail, setDetail] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [signatureAgreed, setSignatureAgreed] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState('');
  const fileInputRef = useRef(null);
  const reduce = useReducedMotion();
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detailRes, filesRes] = await Promise.all([
        onboardingApi.taskDetail(taskId),
        // The obligations panel is a convenience, not the page: if the caller cannot read
        // their personal files the task itself must still open.
        personalFilesApi.mine().catch(() => ({ data: [] })),
      ]);
      setDetail(detailRes.data);
      setFiles(filesRes.data ?? []);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'notFound' : 'load');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    setNotice(null);
    setSignatureAgreed(false);
    setCommentDraft('');
    load();
  }, [load]);

  async function changeStatus(status) {
    setBusy('status');
    setNotice(null);
    try {
      await onboardingApi.setTaskStatus({
        instanceId: detail.instanceId,
        milestoneId: detail.task.milestoneId,
        status,
      });
      await load();
      setNotice({
        tone: 'ok',
        text: t('me.task.statusChanged', { status: t(STATUS_LABEL_KEYS[status]).toLowerCase() }),
      });
    } catch (err) {
      setNotice({ tone: 'error', text: messageOf(err, t('me.task.statusFailed')) });
    } finally {
      setBusy(null);
    }
  }

  async function postComment(event) {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;

    setBusy('comment');
    setNotice(null);
    try {
      const { comments } = await onboardingApi.postTaskComment(detail.task.milestoneId, body);
      setDetail((current) => ({ ...current, comments }));
      setCommentDraft('');
      setNotice({ tone: 'ok', text: t('me.task.comments.posted') });
    } catch (err) {
      setNotice({ tone: 'error', text: messageOf(err, t('me.task.comments.postFailed')) });
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    setBusy('sign');
    setNotice(null);
    try {
      const { signature } = await onboardingApi.signTask(detail.task.milestoneId, SIGNATURE_STATEMENT_FR);
      setDetail((current) => ({ ...current, signature }));
      setNotice({ tone: 'ok', text: t('me.task.signatureSaved') });
    } catch (err) {
      setNotice({ tone: 'error', text: messageOf(err, t('me.task.saveFailed')) });
    } finally {
      setBusy(null);
    }
  }

  async function submitFile(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!selectedFileId || !file) {
      setNotice({ tone: 'error', text: t('me.task.files.pickBoth') });
      return;
    }

    setBusy('file');
    setNotice(null);
    try {
      await personalFilesApi.submit(selectedFileId, file);
      const { data } = await personalFilesApi.mine();
      setFiles(data);
      setSelectedFileId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice({ tone: 'ok', text: t('me.task.files.submitted') });
    } catch (err) {
      setNotice({ tone: 'error', text: messageOf(err, t('me.task.files.submitFailed')) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PageLoading label={t('me.task.loading')} />;
  if (error) {
    return <PageError message={error === 'notFound' ? t('me.task.notFound') : t('me.task.loadFailed')} />;
  }
  if (!detail) return null;

  const { task, history, comments, signature, previousId, nextId } = detail;
  const owner = OWNER_DEPARTMENTS[task.ownerDepartment];
  const phase = TASK_PHASES.find((entry) => entry.id === task.phase);
  const outstanding = files.filter((file) => file.status === 'REQUESTED' || file.status === 'REJECTED');

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={
          phase ? t('me.task.eyebrowWithPhase', { phase: t(phase.labelKey) }) : t('me.task.eyebrow')
        }
        title={task.titleFr}
        subtitle={task.dayLabelFr}
        actions={
          <>
            <Link
              to="/app/me/journey"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              {t('me.task.toJourney')}
            </Link>
            {previousId && (
              <Link
                to={`/app/me/journey/${previousId}`}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {t('me.task.previous')}
              </Link>
            )}
            {nextId && (
              <Link
                to={`/app/me/journey/${nextId}`}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {t('me.task.next')}
              </Link>
            )}
          </>
        }
      />

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              'mb-6 overflow-hidden rounded-app border px-4 py-2 text-sm',
              notice.tone === 'ok'
                ? 'border-status-green/40 bg-status-green/5 text-status-green'
                : 'border-status-red/40 bg-status-red/5 text-status-red',
            )}
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid flex-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Description + the state controls. */}
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={`${CARD} p-6`}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[task.status])}>
                {t(STATUS_LABEL_KEYS[task.status] ?? '', { defaultValue: task.status })}
              </span>
              {task.overdue && (
                <span className="text-xs font-medium text-status-red">{t('me.journey.overdue')}</span>
              )}
              {task.dueSoon && !task.overdue && (
                <span className="text-xs font-medium text-status-amber">{t('me.journey.dueSoon')}</span>
              )}
              {!task.isRecommended && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                  {t('me.journey.optional')}
                </span>
              )}
            </div>

            <h2 className={`mb-2 ${SECTION_TITLE}`}>{t('me.task.brief')}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-dim">{task.detailFr}</p>

            {task.noteFr && (
              <div className="mt-4 rounded-app border border-border bg-surface-2 p-3 text-sm text-text-dim">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  {t('me.task.noteLabel')}
                </p>
                {task.noteFr}
              </div>
            )}

            <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              <Field label={t('me.task.fields.owner')}>
                {owner ? (
                  <>
                    {t(owner.labelKey)}
                    <span className="block text-xs text-text-dim">{t(owner.detailKey)}</span>
                  </>
                ) : (
                  <span className="text-text-dim">{t('me.task.fields.noOwner')}</span>
                )}
              </Field>
              <Field label={t('me.task.fields.dueDate')}>
                {task.dueDate ? (
                  <span className={task.overdue ? 'text-status-red' : undefined}>
                    {new Date(task.dueDate).toLocaleDateString(locale)}
                  </span>
                ) : (
                  <span className="text-text-dim">{t('me.task.fields.noDueDate')}</span>
                )}
              </Field>
              <Field label={t('me.task.fields.completedAt')}>
                {task.completedAt ? (
                  new Date(task.completedAt).toLocaleDateString(locale)
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </Field>
            </dl>

            {NEXT_STATUSES[task.status]?.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                {NEXT_STATUSES[task.status].map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy === 'status'}
                    onClick={() => changeStatus(status)}
                    className={cn(
                      'rounded-app border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                      status === 'DONE'
                        ? 'border-red-brand bg-red-brand text-white hover:bg-red-light'
                        : 'border-border text-text hover:border-red-brand hover:text-red-brand',
                    )}
                  >
                    {status === 'DONE' ? t('me.journey.markDone') : t(STATUS_LABEL_KEYS[status])}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 border-t border-border pt-5 text-sm text-text-dim">
                {t('me.task.validatedNote')}
              </p>
            )}
          </motion.section>

          {/* Acknowledgement record — §2.1's "e-signature (contract)". */}
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.06 }}
            className={`${CARD} p-6`}
          >
            <h2 className={`mb-1 ${SECTION_TITLE}`}>{t('me.task.acknowledge.title')}</h2>
            <p className="mb-4 text-xs leading-relaxed text-text-dim">
              {t('me.task.acknowledge.disclaimer')}
              <strong className="font-medium text-text-muted">
                {t('me.task.acknowledge.disclaimerEmphasis')}
              </strong>
              {t('me.task.acknowledge.disclaimerEnd')}
            </p>

            {signature ? (
              <div className="rounded-app border border-status-green/40 bg-status-green/5 p-4">
                <p className="text-sm font-medium text-status-green">{t('me.task.acknowledge.recorded')}</p>
                <p className="mt-1 text-xs text-text-dim">
                  {t('me.task.acknowledge.recordedAt', {
                    date: new Date(signature.signedAt).toLocaleString(locale),
                  })}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-text-dim">« {signature.statementFr} »</p>
                <p className="mt-3 break-all font-mono text-[11px] text-text-dim">
                  {t('me.task.acknowledge.hash', { hash: signature.signatureHash })}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="rounded-app border border-border bg-surface-2 p-3 text-sm text-text-dim">
                  « {SIGNATURE_STATEMENT_FR} »
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={signatureAgreed}
                    onChange={(event) => setSignatureAgreed(event.target.checked)}
                    className="mt-0.5 accent-[var(--color-red-brand)]"
                  />
                  {t('me.task.acknowledge.agreeLabel')}
                </label>
                <button
                  type="button"
                  disabled={!signatureAgreed || busy === 'sign'}
                  onClick={sign}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                >
                  {busy === 'sign' ? t('me.task.acknowledge.saving') : t('me.task.acknowledge.submit')}
                </button>
              </div>
            )}
          </motion.section>

          {/* Comment thread — also the "request help" path of §2.1. */}
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.12 }}
          >
            <h2 className={`mb-1 ${SECTION_TITLE}`}>{t('me.task.comments.title')}</h2>
            <p className="mb-4 text-xs text-text-dim">{t('me.task.comments.help')}</p>

            <motion.ul
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="mb-4 space-y-3"
            >
              {comments.map((comment) => (
                <motion.li key={comment.id} variants={staggerItem} className={`${CARD} p-4`}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-text">{comment.authorLabel}</span>
                    <span className="text-xs text-text-dim">
                      {new Date(comment.createdAt).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text-dim">{comment.bodyFr}</p>
                </motion.li>
              ))}
            </motion.ul>

            {comments.length === 0 && (
              <div className="mb-4">
                <EmptyState detail={t('me.task.comments.empty')} muted />
              </div>
            )}

            <form onSubmit={postComment} className={`${CARD} p-4`}>
              <label className="block text-sm text-text-muted">
                {t('me.task.comments.yourMessage')}
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={t('me.task.comments.placeholder')}
                  className="mt-1 w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
                />
              </label>
              <button
                type="submit"
                disabled={busy === 'comment' || commentDraft.trim().length === 0}
                className="mt-3 rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
              >
                {busy === 'comment' ? t('me.task.comments.sending') : t('me.task.comments.send')}
              </button>
            </form>
          </motion.section>
        </div>

        {/* Right column — attachments and history. */}
        <div className="space-y-8">
          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.08 }}
            className={`${CARD} p-5`}
          >
            <h2 className={`mb-1 ${SECTION_TITLE}`}>{t('me.task.files.title')}</h2>
            <p className="mb-4 text-xs text-text-dim">
              {t('me.task.files.help')}
              <Link to="/app/me/files" className="ml-1 font-medium text-red-brand hover:underline">
                {t('me.task.files.linkLabel')}
              </Link>
              .
            </p>

            {outstanding.length === 0 ? (
              <EmptyState detail={t('me.task.files.empty')} muted />
            ) : (
              <form onSubmit={submitFile} className="space-y-3">
                <select
                  value={selectedFileId}
                  onChange={(event) => setSelectedFileId(event.target.value)}
                  className="w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
                >
                  <option value="">{t('me.task.files.chooseOne')}</option>
                  {outstanding.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.labelFr}
                      {file.status === 'REJECTED' ? t('me.task.files.redo') : ''}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="w-full text-xs text-text-dim file:mr-3 file:rounded-app file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-text"
                />
                <button
                  type="submit"
                  disabled={busy === 'file'}
                  className="w-full rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                >
                  {busy === 'file' ? t('me.task.files.sending') : t('me.task.files.submit')}
                </button>
              </form>
            )}
          </motion.section>

          <motion.section
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            transition={{ delay: reduce ? 0 : 0.14 }}
          >
            <h2 className={`mb-1 ${SECTION_TITLE}`}>{t('me.task.history.title')}</h2>
            <p className="mb-4 text-xs text-text-dim">{t('me.task.history.help')}</p>

            {history.length === 0 ? (
              <EmptyState detail={t('me.task.history.empty')} muted />
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-red-brand" aria-hidden />
                    <p className="text-sm text-text">
                      {entry.from
                        ? `${t(STATUS_LABEL_KEYS[entry.from] ?? '', { defaultValue: entry.from })} → `
                        : ''}
                      <span className="font-medium">
                        {t(STATUS_LABEL_KEYS[entry.to] ?? '', { defaultValue: entry.to })}
                      </span>
                    </p>
                    <p className="text-xs text-text-dim">
                      {entry.actorLabel ?? t('me.task.history.system')} ·{' '}
                      {new Date(entry.at).toLocaleString(locale)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

function messageOf(error, fallback) {
  if (error instanceof ApiError && error.body?.message) return error.body.message;
  return fallback;
}
