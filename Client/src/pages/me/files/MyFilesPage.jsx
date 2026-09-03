import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { personalFilesApi } from '../../../api/personal-files.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * Each status says what it means *for the recruit*, not just what it is called: "SUBMITTED"
 * is only useful if it also says "nothing more to do until HR answer". `yours` is the one
 * piece of behaviour here — whether the ball is in the recruit's court — so it lives in code
 * while the words live in the catalogue.
 */
const STATUS = {
  REQUESTED: { tone: 'bg-red-brand/10 text-red-brand', yours: true },
  SUBMITTED: { tone: 'bg-status-blue/10 text-status-blue', yours: false },
  ACCEPTED: { tone: 'bg-status-green/10 text-status-green', yours: false },
  REJECTED: { tone: 'bg-status-red/10 text-status-red', yours: true },
};

/**
 * /app/me/files — My supporting documents (route guide §2.1, CORE).
 * "Personal admin documents to submit (ID, diplomas, bank details, medical certificate) —
 * upload, see HR validation status."
 *
 * The upload is real: POST /personal-files/:id/submit buffers through multer and streams to
 * Cloudinary. With no Cloudinary credentials the server answers 501 and the message it sends
 * back is shown as-is, because "no storage is configured, send it another way" is exactly
 * what the recruit needs to read — a generic failure would have them retry forever.
 *
 * The list is the caller's own obligations only: GET /personal-files/me filters on
 * `userId: req.user.id` server-side, so there is no client-side narrowing to get wrong.
 */
export default function MyFilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const fileInputs = useRef({});
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n);

  const load = useCallback(async () => {
    try {
      const { data } = await personalFilesApi.mine();
      setFiles(data);
    } catch (err) {
      setError(err instanceof ApiError ? 'load' : 'generic');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 20 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 });
    },
    [loading, files],
  );

  const summary = useMemo(() => {
    const accepted = files.filter((file) => file.status === 'ACCEPTED').length;
    const outstanding = files.filter((file) => STATUS[file.status]?.yours).length;
    return {
      total: files.length,
      accepted,
      outstanding,
      submitted: files.filter((file) => file.status === 'SUBMITTED').length,
      percent: files.length === 0 ? 0 : Math.round((accepted / files.length) * 100),
    };
  }, [files]);

  async function submit(file) {
    const input = fileInputs.current[file.id];
    const chosen = input?.files?.[0];
    if (!chosen) {
      setNotice({ tone: 'error', text: t('me.files.pickFile') });
      return;
    }

    setBusyId(file.id);
    setNotice(null);
    try {
      await personalFilesApi.submit(file.id, chosen, notes[file.id]?.trim() || undefined);
      if (input) input.value = '';
      setNotes((current) => ({ ...current, [file.id]: '' }));
      await load();
      setNotice({ tone: 'ok', text: t('me.files.submitOk', { label: file.labelFr }) });
    } catch (err) {
      setNotice({
        tone: 'error',
        text:
          err instanceof ApiError && err.body?.message ? err.body.message : t('me.files.submitFailed'),
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageLoading label={t('me.files.loading')} />;
  if (error) {
    return <PageError message={error === 'load' ? t('me.files.loadFailed') : t('me.files.loadError')} />;
  }

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.files.title')}
        subtitle={t('me.files.subtitle')}
      />

      {files.length === 0 ? (
        <EmptyState title={t('me.files.emptyTitle')} detail={t('me.files.emptyDetail')} muted />
      ) : (
        <>
          <div data-gsap="band" className={`mb-8 flex flex-wrap items-center gap-8 ${CARD} p-6`}>
            <ProgressRing percent={summary.percent} tone={summary.percent >= 100 ? 'green' : 'brand'} />
            <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4">
              <Figure label={t('me.files.figures.requested')} value={summary.total} />
              <Figure label={t('me.files.figures.accepted')} value={summary.accepted} />
              <Figure label={t('me.files.figures.underReview')} value={summary.submitted} />
              <Figure
                label={t('me.files.figures.pendingOnYou')}
                value={summary.outstanding}
                tone={summary.outstanding > 0 ? 'red' : undefined}
              />
            </div>
          </div>

          <AnimatePresence>
            {notice && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'mb-4 overflow-hidden rounded-app border px-4 py-2 text-sm',
                  notice.tone === 'ok'
                    ? 'border-status-green/40 bg-status-green/5 text-status-green'
                    : 'border-status-red/40 bg-status-red/5 text-status-red',
                )}
              >
                {notice.text}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.ul
            data-gsap="band"
            variants={staggerContainer(0.05, 0.15)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="flex-1 space-y-3"
          >
            {files.map((file) => {
              const known = STATUS[file.status];
              const state = {
                label: known ? t(`me.files.status.${file.status}.label`) : file.status,
                lead: known ? t(`me.files.status.${file.status}.lead`) : '',
                tone: known?.tone ?? 'bg-surface-2 text-text-dim',
              };

              return (
                <motion.li
                  key={file.id}
                  variants={staggerItem}
                  className={cn(
                    CARD,
                    'p-4',
                    file.status === 'ACCEPTED' ? 'border-status-green/40' : '',
                    file.status === 'REJECTED' ? 'border-status-red/40' : '',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-text">{file.labelFr}</h2>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', state.tone)}>
                          {state.label}
                        </span>
                      </div>
                      <p className="text-sm text-text-dim">{state.lead}</p>

                      {file.noteFr && (
                        <p className="mt-2 rounded-app border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
                          {t('me.files.note', { note: file.noteFr })}
                        </p>
                      )}

                      {file.submittedAt && (
                        <p className="mt-1 font-mono text-[11px] text-text-dim">
                          {t('me.files.submittedAt', {
                            date: new Date(file.submittedAt).toLocaleDateString(locale),
                          })}
                          {file.reviewedAt
                            ? t('me.files.reviewedAt', {
                                date: new Date(file.reviewedAt).toLocaleDateString(locale),
                              })
                            : ''}
                        </p>
                      )}

                      {file.url && (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-red-brand hover:underline"
                        >
                          {t('me.files.viewFile')}
                        </a>
                      )}
                    </div>

                    {file.status !== 'ACCEPTED' && (
                      <div className="w-full max-w-xs shrink-0 space-y-2">
                        <input
                          type="file"
                          ref={(element) => {
                            fileInputs.current[file.id] = element;
                          }}
                          className="w-full text-xs text-text-dim file:me-3 file:rounded-app file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-text"
                        />
                        <input
                          type="text"
                          value={notes[file.id] ?? ''}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [file.id]: event.target.value }))
                          }
                          maxLength={500}
                          placeholder={t('me.files.notePlaceholder')}
                          className="w-full rounded-app border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none transition-colors focus:border-red-brand"
                        />
                        <button
                          type="button"
                          onClick={() => submit(file)}
                          disabled={busyId === file.id}
                          className="w-full rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                        >
                          {busyId === file.id ? t('me.files.sending') : t('me.files.submit')}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        </>
      )}
    </div>
  );
}

function Figure({ label, value, tone }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={cn('font-display text-2xl', tone === 'red' ? 'text-status-red' : 'text-red-deep')}>
        <CountUp value={value} />
      </p>
    </div>
  );
}
