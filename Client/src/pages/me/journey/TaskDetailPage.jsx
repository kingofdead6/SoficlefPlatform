import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { onboardingApi } from '../../../api/onboarding.js';
import { personalFilesApi } from '../../../api/personal-files.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';
import { OWNER_DEPARTMENTS, STATUS_LABELS, STATUS_STYLES, TASK_PHASES } from './taskVocabulary.js';

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
      setError(
        err instanceof ApiError && err.status === 404
          ? "Cette étape n'existe pas dans votre parcours."
          : "Impossible de charger cette étape.",
      );
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
      setNotice({ tone: 'ok', textFr: `Étape marquée « ${STATUS_LABELS[status].toLowerCase()} ».` });
    } catch (err) {
      setNotice({ tone: 'error', textFr: messageOf(err, "La mise à jour de l'étape a échoué.") });
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
      setNotice({ tone: 'ok', textFr: 'Message envoyé.' });
    } catch (err) {
      setNotice({ tone: 'error', textFr: messageOf(err, "L'envoi du message a échoué.") });
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
      setNotice({ tone: 'ok', textFr: 'Votre confirmation de lecture a été enregistrée.' });
    } catch (err) {
      setNotice({ tone: 'error', textFr: messageOf(err, "L'enregistrement a échoué.") });
    } finally {
      setBusy(null);
    }
  }

  async function submitFile(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!selectedFileId || !file) {
      setNotice({ tone: 'error', textFr: 'Choisissez la pièce concernée puis un fichier.' });
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
      setNotice({ tone: 'ok', textFr: 'Pièce transmise aux RH pour vérification.' });
    } catch (err) {
      setNotice({ tone: 'error', textFr: messageOf(err, "La transmission a échoué.") });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PageLoading label="Chargement de l’étape…" />;
  if (error) return <PageError message={error} />;
  if (!detail) return null;

  const { task, history, comments, signature, previousId, nextId } = detail;
  const owner = OWNER_DEPARTMENTS[task.ownerDepartment];
  const phase = TASK_PHASES.find((entry) => entry.id === task.phase);
  const outstanding = files.filter((file) => file.status === 'REQUESTED' || file.status === 'REJECTED');

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={phase ? `Mon parcours · ${phase.labelFr}` : 'Mon parcours'}
        title={task.titleFr}
        subtitle={task.dayLabelFr}
        actions={
          <>
            <Link
              to="/app/me/journey"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Retour au parcours
            </Link>
            {previousId && (
              <Link
                to={`/app/me/journey/${previousId}`}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                ← Précédente
              </Link>
            )}
            {nextId && (
              <Link
                to={`/app/me/journey/${nextId}`}
                className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                Suivante →
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
            {notice.textFr}
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
                {STATUS_LABELS[task.status]}
              </span>
              {task.overdue && <span className="text-xs font-medium text-status-red">En retard</span>}
              {task.dueSoon && !task.overdue && (
                <span className="text-xs font-medium text-status-amber">Échéance proche</span>
              )}
              {!task.isRecommended && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">Facultative</span>
              )}
            </div>

            <h2 className={`mb-2 ${SECTION_TITLE}`}>Ce qui vous est demandé</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-dim">{task.detailFr}</p>

            {task.noteFr && (
              <div className="mt-4 rounded-app border border-border bg-surface-2 p-3 text-sm text-text-dim">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Note</p>
                {task.noteFr}
              </div>
            )}

            <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              <Field label="Service responsable">
                {owner ? (
                  <>
                    {owner.labelFr}
                    <span className="block text-xs text-text-dim">{owner.detailFr}</span>
                  </>
                ) : (
                  <span className="text-text-dim">Non déclaré sur cette étape</span>
                )}
              </Field>
              <Field label="Échéance">
                {task.dueDate ? (
                  <span className={task.overdue ? 'text-status-red' : undefined}>
                    {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                  </span>
                ) : (
                  <span className="text-text-dim">Aucune</span>
                )}
              </Field>
              <Field label="Terminée le">
                {task.completedAt ? (
                  new Date(task.completedAt).toLocaleDateString('fr-FR')
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
                    {status === 'DONE' ? 'Marquer terminée' : STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 border-t border-border pt-5 text-sm text-text-dim">
                Cette étape a été validée par votre manager : elle ne peut plus être modifiée depuis votre espace.
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
            <h2 className={`mb-1 ${SECTION_TITLE}`}>Confirmation de lecture</h2>
            <p className="mb-4 text-xs leading-relaxed text-text-dim">
              Il ne s’agit pas d’une signature électronique qualifiée : la plateforme ne dispose ni d’autorité de
              certification, ni de clé de signature, ni d’horodatage certifié. Ce qui est conservé est un
              <strong className="font-medium text-text-muted"> accusé de lecture</strong> : votre identifiant de
              compte, le texte exact auquel vous adhérez, la date et l’heure, et une empreinte SHA-256 de
              l’ensemble qui permet de détecter une modification ultérieure de ce texte.
            </p>

            {signature ? (
              <div className="rounded-app border border-status-green/40 bg-status-green/5 p-4">
                <p className="text-sm font-medium text-status-green">Confirmation enregistrée</p>
                <p className="mt-1 text-xs text-text-dim">
                  Le {new Date(signature.signedAt).toLocaleString('fr-FR')}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-text-dim">« {signature.statementFr} »</p>
                <p className="mt-3 break-all font-mono text-[11px] text-text-dim">
                  Empreinte : {signature.signatureHash}
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
                  J’ai lu ce texte et je le confirme.
                </label>
                <button
                  type="button"
                  disabled={!signatureAgreed || busy === 'sign'}
                  onClick={sign}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                >
                  {busy === 'sign' ? 'Enregistrement…' : 'Enregistrer ma confirmation'}
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
            <h2 className={`mb-1 ${SECTION_TITLE}`}>Échanges sur cette étape</h2>
            <p className="mb-4 text-xs text-text-dim">
              Bloqué ou en doute ? Écrivez ici : votre manager et les RH voient ce fil depuis le dossier de votre
              intégration.
            </p>

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
                      {new Date(comment.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text-dim">{comment.bodyFr}</p>
                </motion.li>
              ))}
            </motion.ul>

            {comments.length === 0 && (
              <div className="mb-4">
                <EmptyState detail="Aucun message pour l’instant." muted />
              </div>
            )}

            <form onSubmit={postComment} className={`${CARD} p-4`}>
              <label className="block text-sm text-text-muted">
                Votre message
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Ex. : je n’ai pas reçu le formulaire à signer, à qui dois-je m’adresser ?"
                  className="mt-1 w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
                />
              </label>
              <button
                type="submit"
                disabled={busy === 'comment' || commentDraft.trim().length === 0}
                className="mt-3 rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
              >
                {busy === 'comment' ? 'Envoi…' : 'Envoyer'}
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
            <h2 className={`mb-1 ${SECTION_TITLE}`}>Pièces à fournir</h2>
            <p className="mb-4 text-xs text-text-dim">
              Les pièces administratives ne sont pas rattachées à une étape précise dans la plateforme : elles
              constituent votre dossier RH. Vous pouvez en transmettre une ici, elle apparaîtra dans
              <Link to="/app/me/files" className="ml-1 font-medium text-red-brand hover:underline">
                Mes justificatifs
              </Link>
              .
            </p>

            {outstanding.length === 0 ? (
              <EmptyState detail="Aucune pièce n’est attendue de votre part." muted />
            ) : (
              <form onSubmit={submitFile} className="space-y-3">
                <select
                  value={selectedFileId}
                  onChange={(event) => setSelectedFileId(event.target.value)}
                  className="w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
                >
                  <option value="">Choisir la pièce…</option>
                  {outstanding.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.labelFr}
                      {file.status === 'REJECTED' ? ' (à refaire)' : ''}
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
                  {busy === 'file' ? 'Envoi…' : 'Transmettre la pièce'}
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
            <h2 className={`mb-1 ${SECTION_TITLE}`}>Historique</h2>
            <p className="mb-4 text-xs text-text-dim">
              Reconstitué depuis le journal d’audit : chaque changement de statut, qui l’a fait et quand.
            </p>

            {history.length === 0 ? (
              <EmptyState detail="Aucun changement enregistré sur cette étape." muted />
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-red-brand" aria-hidden />
                    <p className="text-sm text-text">
                      {entry.from ? `${STATUS_LABELS[entry.from] ?? entry.from} → ` : ''}
                      <span className="font-medium">{STATUS_LABELS[entry.to] ?? entry.to}</span>
                    </p>
                    <p className="text-xs text-text-dim">
                      {entry.actorLabel ?? 'Système'} · {new Date(entry.at).toLocaleString('fr-FR')}
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
