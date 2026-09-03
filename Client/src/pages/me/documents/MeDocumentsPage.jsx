import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { documentsApi } from '../../../api/documents.js';
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
 * The families §2.1 names — welcome guide, internal regulations, HR/quality procedures, IT
 * charter — matched against the document's slug.
 *
 * Slug-matching rather than a schema column: `Document` has no category field, and adding
 * one would mean a migration whose only consumer is this page's headings. A document whose
 * slug matches nothing falls into "Other documents" rather than disappearing — an
 * unclassified document is still a document the recruit must be able to open.
 *
 * The regexes stay French-only on purpose: they match `slug` and `titleFr`, which are
 * database content, not UI text. Translating them would stop them matching anything.
 */
const FAMILIES = [
  { id: 'welcome', match: /accueil|welcome|livret|bienvenue/i },
  { id: 'rules', match: /reglement|règlement|interieur|intérieur|discipline/i },
  { id: 'procedures', match: /procedure|procédure|rh|qualite|qualité|smq|process/i },
  { id: 'it', match: /informatique|charte|it|si|systeme-information|cyber/i },
];

/**
 * /app/me/documents — Documents (route guide §2.1, CHAIN/SITE).
 * "Welcome guide, internal regulations, HR/quality procedures, IT charter; document viewer;
 * 'read and accepted' acknowledgment with timestamp."
 *
 * Backed by GET /documents/me, which returns every published document together with *this
 * caller's* acknowledgedAt — one call, and the acknowledgement state is per-person by
 * construction rather than by a filter this page applies.
 *
 * The "viewer" is an inline panel: a document with a file gets an <iframe> onto its
 * Cloudinary URL, which is what the browser can genuinely render for a PDF. A document
 * awaiting its file (availability PENDING, or storage not configured) says so instead of
 * showing an empty frame — and cannot be acknowledged, because there would be nothing to
 * have read.
 */
export default function MeDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t, i18n } = useTranslation();

  const load = useCallback(async () => {
    try {
      const { data } = await documentsApi.mine();
      setDocuments(data);
    } catch {
      setError('load');
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
    [loading, documents],
  );

  const groups = useMemo(() => {
    const claimed = new Set();
    const families = FAMILIES.map((family) => {
      const docs = documents.filter((doc) => {
        if (claimed.has(doc.id)) return false;
        const hay = `${doc.slug} ${doc.titleFr}`;
        if (!family.match.test(hay)) return false;
        claimed.add(doc.id);
        return true;
      });
      return {
        id: family.id,
        label: t(`me.documents.families.${family.id}.label`),
        detail: t(`me.documents.families.${family.id}.detail`),
        documents: docs,
      };
    });

    const rest = documents.filter((doc) => !claimed.has(doc.id));
    if (rest.length > 0) {
      families.push({
        id: 'others',
        label: t('me.documents.families.others.label'),
        detail: t('me.documents.families.others.detail'),
        documents: rest,
      });
    }

    return families.filter((family) => family.documents.length > 0);
  }, [documents, t]);

  const summary = useMemo(() => {
    const readable = documents.filter((doc) => doc.availability === 'AVAILABLE');
    const acknowledged = documents.filter((doc) => doc.acknowledgedAt);
    return {
      total: documents.length,
      readable: readable.length,
      acknowledged: acknowledged.length,
      pending: readable.length - acknowledged.filter((doc) => doc.availability === 'AVAILABLE').length,
      percent: readable.length === 0 ? 0 : Math.round((acknowledged.length / readable.length) * 100),
    };
  }, [documents]);

  async function acknowledge(doc) {
    setBusyId(doc.id);
    setNotice(null);
    try {
      await documentsApi.acknowledge(doc.id);
      await load();
      setNotice({ tone: 'ok', text: t('me.documents.acknowledgeOk', { title: doc.titleFr }) });
    } catch (err) {
      setNotice({
        tone: 'error',
        text:
          err instanceof ApiError && err.body?.message
            ? err.body.message
            : t('me.documents.acknowledgeFailed'),
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageLoading label={t('me.documents.loading')} />;
  if (error) return <PageError message={t('me.documents.loadFailed')} />;

  const visibleGroups = filter === 'ALL' ? groups : groups.filter((group) => group.id === filter);

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.documents.title')}
        subtitle={t('me.documents.subtitle')}
      />

      {documents.length === 0 ? (
        <EmptyState
          title={t('me.documents.emptyTitle')}
          detail={t('me.documents.emptyDetail')}
          muted
        />
      ) : (
        <>
          <div data-gsap="band" className={`mb-8 flex flex-wrap items-center gap-8 ${CARD} p-6`}>
            <ProgressRing
              percent={summary.percent}
              tone={summary.percent >= 100 ? 'green' : summary.pending > 0 ? 'brand' : 'brand'}
            />
            <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3">
              <Figure label={t('me.documents.figures.published')} value={summary.total} />
              <Figure label={t('me.documents.figures.acknowledged')} value={summary.acknowledged} />
              <Figure
                label={t('me.documents.figures.pendingOnYou')}
                value={Math.max(0, summary.readable - summary.acknowledged)}
                tone={summary.readable - summary.acknowledged > 0 ? 'red' : undefined}
              />
            </div>
          </div>

          <div data-gsap="band" className="mb-6 flex flex-wrap gap-2 border-b border-border">
            {[{ id: 'ALL', label: t('common.all') }, ...groups].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  filter === tab.id
                    ? 'border-red-brand text-red-deep'
                    : 'border-transparent text-text-dim hover:text-text',
                )}
              >
                {tab.label}
                {tab.documents ? ` (${tab.documents.length})` : ''}
              </button>
            ))}
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

          <div data-gsap="band" className="flex-1 space-y-10">
            {visibleGroups.map((group) => (
              <section key={group.id}>
                <h2 className="font-display text-xl text-text">{group.label}</h2>
                <p className="mb-4 text-xs text-text-dim">{group.detail}</p>

                <motion.ul
                  variants={staggerContainer(0.05, 0.15)}
                  initial={initialOrNone(reduce)}
                  animate="visible"
                  className="space-y-3"
                >
                  {group.documents.map((doc) => (
                    <motion.li key={doc.id} variants={staggerItem}>
                      <DocumentRow
                        doc={doc}
                        open={openId === doc.id}
                        onToggle={() => setOpenId((current) => (current === doc.id ? null : doc.id))}
                        onAcknowledge={() => acknowledge(doc)}
                        busy={busyId === doc.id}
                        reduce={reduce}
                        t={t}
                        locale={localeOf(i18n)}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            ))}
          </div>
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

function DocumentRow({ doc, open, onToggle, onAcknowledge, busy, reduce, t, locale }) {
  const readable = doc.availability === 'AVAILABLE' && Boolean(doc.url);
  const acknowledged = Boolean(doc.acknowledgedAt);

  return (
    <div className={cn(CARD, acknowledged ? 'border-status-green/40' : '')}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-text">{doc.titleFr}</h3>
            {acknowledged ? (
              <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
                {t('me.documents.acknowledged')}
              </span>
            ) : readable ? (
              <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
                {t('me.documents.toRead')}
              </span>
            ) : (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                {t('me.documents.pending')}
              </span>
            )}
          </div>

          {doc.detailFr && <p className="text-sm text-text-dim">{doc.detailFr}</p>}

          {acknowledged && (
            <p className="mt-1 font-mono text-[11px] text-text-dim">
              {t('me.documents.acknowledgedAt', {
                date: new Date(doc.acknowledgedAt).toLocaleString(locale),
              })}
            </p>
          )}

          {!readable && <p className="mt-1 text-xs text-text-dim">{t('me.documents.noFile')}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {readable && (
            <>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {open ? t('me.documents.close') : t('me.documents.read')}
              </button>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
              >
                {t('me.documents.openInTab')}
              </a>
            </>
          )}
          {readable && !acknowledged && (
            <button
              type="button"
              disabled={busy}
              onClick={onAcknowledge}
              className="rounded-app bg-red-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
            >
              {busy ? t('common.states.saving') : t('me.documents.acknowledgeButton')}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && readable && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <iframe
              title={doc.titleFr}
              src={doc.url}
              className="h-[70vh] w-full bg-surface-2"
            />
            <p className="px-4 py-2 text-[11px] text-text-dim">{t('me.documents.iframeFallback')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
