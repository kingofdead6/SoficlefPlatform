import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { personalFilesApi } from '../../../api/personal-files.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * Each status says what it means *for the recruit*, not just what it is called. "SUBMITTED"
 * is only useful if it also says "nothing more to do until the RH answer".
 */
const STATUS = {
  REQUESTED: {
    labelFr: 'À fournir',
    tone: 'bg-red-brand/10 text-red-brand',
    leadFr: 'Les RH attendent cette pièce.',
    yours: true,
  },
  SUBMITTED: {
    labelFr: 'Transmise',
    tone: 'bg-status-blue/10 text-status-blue',
    leadFr: 'Reçue. En attente de vérification par les RH — rien à faire de votre côté.',
    yours: false,
  },
  ACCEPTED: {
    labelFr: 'Validée',
    tone: 'bg-status-green/10 text-status-green',
    leadFr: 'Vérifiée et acceptée par les RH.',
    yours: false,
  },
  REJECTED: {
    labelFr: 'À refaire',
    tone: 'bg-status-red/10 text-status-red',
    leadFr: 'Les RH ont besoin d’une nouvelle version de cette pièce.',
    yours: true,
  },
};

/**
 * /app/me/files — Mes justificatifs (route guide §2.1, CORE).
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

  const load = useCallback(async () => {
    try {
      const { data } = await personalFilesApi.mine();
      setFiles(data);
    } catch (err) {
      setError(err instanceof ApiError ? 'Impossible de charger vos justificatifs.' : 'Erreur de chargement.');
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
      setNotice({ tone: 'error', textFr: 'Choisissez un fichier avant de le transmettre.' });
      return;
    }

    setBusyId(file.id);
    setNotice(null);
    try {
      await personalFilesApi.submit(file.id, chosen, notes[file.id]?.trim() || undefined);
      if (input) input.value = '';
      setNotes((current) => ({ ...current, [file.id]: '' }));
      await load();
      setNotice({ tone: 'ok', textFr: `« ${file.labelFr} » transmise aux RH.` });
    } catch (err) {
      setNotice({
        tone: 'error',
        textFr:
          err instanceof ApiError && err.body?.message
            ? err.body.message
            : 'Échec de la transmission.',
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageLoading label="Chargement de vos justificatifs…" />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Mon espace"
        title="Mes justificatifs"
        subtitle="Les pièces administratives demandées par les RH : pièce d’identité, diplômes, relevé d’identité bancaire, certificat médical."
      />

      {files.length === 0 ? (
        <EmptyState
          title="Rien à fournir"
          detail="Aucune pièce administrative ne vous est demandée pour l’instant. Les RH ajoutent ici ce dont elles ont besoin."
          muted
        />
      ) : (
        <>
          <div data-gsap="band" className={`mb-8 flex flex-wrap items-center gap-8 ${CARD} p-6`}>
            <ProgressRing percent={summary.percent} tone={summary.percent >= 100 ? 'green' : 'brand'} />
            <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4">
              <Figure label="Demandées" value={summary.total} />
              <Figure label="Validées" value={summary.accepted} />
              <Figure label="En vérification" value={summary.submitted} />
              <Figure
                label="En attente de vous"
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
                {notice.textFr}
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
              const state = STATUS[file.status] ?? {
                labelFr: file.status,
                tone: 'bg-surface-2 text-text-dim',
                leadFr: '',
                yours: false,
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
                          {state.labelFr}
                        </span>
                      </div>
                      <p className="text-sm text-text-dim">{state.leadFr}</p>

                      {file.noteFr && (
                        <p className="mt-2 rounded-app border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
                          Note : {file.noteFr}
                        </p>
                      )}

                      {file.submittedAt && (
                        <p className="mt-1 font-mono text-[11px] text-text-dim">
                          Transmise le {new Date(file.submittedAt).toLocaleDateString('fr-FR')}
                          {file.reviewedAt
                            ? ` · vérifiée le ${new Date(file.reviewedAt).toLocaleDateString('fr-FR')}`
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
                          Voir le fichier transmis
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
                          className="w-full text-xs text-text-dim file:mr-3 file:rounded-app file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-text"
                        />
                        <input
                          type="text"
                          value={notes[file.id] ?? ''}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [file.id]: event.target.value }))
                          }
                          maxLength={500}
                          placeholder="Note pour les RH (facultatif)"
                          className="w-full rounded-app border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none transition-colors focus:border-red-brand"
                        />
                        <button
                          type="button"
                          onClick={() => submit(file)}
                          disabled={busyId === file.id}
                          className="w-full rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
                        >
                          {busyId === file.id ? 'Envoi…' : 'Transmettre'}
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
