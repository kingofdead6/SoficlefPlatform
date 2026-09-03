import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { trainingApi } from '../../../api/training.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * /app/me/training/certificates — Mes attestations (route guide §2.1, SITE).
 * "Downloadable certificates, issue dates."
 *
 * Backed by GET /training/certificates/me: the caller's passed attempts whose `certifiedAt`
 * is set, one per module, newest first.
 *
 * What "downloadable" means here, precisely: the platform generates a printable attestation
 * in the browser (a print view, and a plain-text copy). It is **not** a signed or verifiable
 * certificate — there is no certificate authority, signing key or public verification
 * endpoint in this deployment, so a PDF claiming to be verifiable would be a claim the
 * system cannot honour. The attestation says what it is and carries the attempt identifier,
 * which is the reference the RH can check against the platform's own records. The page says
 * this plainly rather than in small print.
 */
export default function CertificatesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await trainingApi.myCertificates();
        setCertificates(data);
      } catch {
        setError(t('me.training.certificates.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const summary = useMemo(
    () => ({
      total: certificates.length,
      mandatory: certificates.filter((row) => row.isMandatory).length,
      lastAt: certificates[0]?.certifiedAt ?? null,
    }),
    [certificates],
  );

  if (loading) return <PageLoading label={t('me.training.certificates.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.training.title')}
        title={t('nav.items.meCertificates')}
        subtitle={t('me.training.certificates.subtitle')}
        actions={
          <Link
            to="/app/me/training"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('me.training.module.backToModules')}
          </Link>
        }
      />

      {certificates.length === 0 ? (
        <EmptyState
          title={t('me.training.certificates.emptyTitle')}
          detail={t('me.training.certificates.emptyDetail')}
          muted
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Figure label={t('me.training.certificates.total')} value={summary.total} />
            <Figure label={t('me.training.certificates.mandatoryCount')} value={summary.mandatory} />
            <div className={`${CARD} p-5`}>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                {t('me.training.certificates.lastIssued')}
              </p>
              <p className="font-display text-2xl text-red-deep">
                {summary.lastAt ? new Date(summary.lastAt).toLocaleDateString(localeOf(i18n)) : '—'}
              </p>
            </div>
          </div>

          <p className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs leading-relaxed text-text-dim">
            {t('me.training.certificates.disclaimerLede')}{' '}
            <strong className="font-medium text-text-muted">{t('me.training.certificates.disclaimerBold')}</strong>
            {t('me.training.certificates.disclaimerTail')}
          </p>

          <motion.ul
            variants={staggerContainer(0.06, 0.15)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="flex-1 space-y-3"
          >
            {certificates.map((certificate) => (
              <motion.li key={certificate.id} variants={staggerItem}>
                <CertificateRow certificate={certificate} holderName={user?.displayName ?? ''} />
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </div>
  );
}

function CertificateRow({ certificate, holderName }) {
  const { t, i18n } = useTranslation();
  const issuedAt = new Date(certificate.certifiedAt);
  const isEnglish = i18n.language === 'en';
  const locale = localeOf(i18n);

  /**
   * The printable view. Opened in a new window rather than rendered inline so the browser's
   * own print dialog (and its "save as PDF") does the file production — the platform makes
   * no claim about the resulting file beyond what the page itself says. Its own language
   * follows the active UI language rather than always being French, since this is a document
   * the recruit keeps and may need to present in either language.
   */
  function print() {
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return;

    const escape = (value) =>
      String(value ?? '').replace(/[&<>"']/g, (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
      );

    const character = certificate.isMandatory
      ? t('me.training.certificates.print.mandatory')
      : t('me.training.certificates.print.optional');

    win.document.write(`<!doctype html><html lang="${isEnglish ? 'en' : 'fr'}"><head><meta charset="utf-8">
<title>${escape(t('me.training.certificates.print.docTitle', { module: certificate.moduleTitleFr }))}</title>
<style>
  body { font-family: Georgia, serif; color: #171314; margin: 0; padding: 56px 64px; }
  .rule { border-top: 3px solid #c8102e; width: 72px; margin: 0 0 28px; }
  h1 { font-size: 26px; margin: 0 0 6px; color: #7f0a1d; }
  h2 { font-size: 20px; margin: 26px 0 6px; }
  p { line-height: 1.7; font-size: 14px; }
  dl { margin: 28px 0; font-size: 14px; }
  dt { font-weight: bold; margin-top: 12px; }
  .note { margin-top: 40px; padding-top: 18px; border-top: 1px solid #e6e0e1; font-size: 12px; color: #6b6164; }
  .ref { font-family: ui-monospace, monospace; font-size: 12px; }
</style></head><body>
<div class="rule"></div>
<h1>${escape(t('me.training.certificates.print.heading'))}</h1>
<p>${escape(t('me.training.certificates.print.issuedBy'))}</p>
<h2>${escape(holderName)}</h2>
<p>${escape(t('me.training.certificates.print.hasValidated'))}</p>
<dl>
  <dt>${escape(t('me.training.certificates.print.module'))}</dt><dd>${escape(certificate.moduleTitleFr)} (${escape(certificate.moduleCode)})</dd>
  <dt>${escape(t('me.training.certificates.print.character'))}</dt><dd>${escape(character)}</dd>
  <dt>${escape(t('me.training.certificates.print.scoreLabel'))}</dt><dd>${escape(t('me.training.certificates.print.scoreValue', { score: certificate.score, threshold: certificate.passingScore }))}</dd>
  <dt>${escape(t('me.training.certificates.print.issuedOn'))}</dt><dd>${escape(issuedAt.toLocaleDateString(locale))}</dd>
  <dt>${escape(t('me.training.certificates.print.attemptRef'))}</dt><dd class="ref">${escape(certificate.id)}</dd>
</dl>
<p class="note">${escape(t('me.training.certificates.print.footnote'))}</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  /** A plain-text copy, for anyone who needs to paste the facts rather than print them. */
  function downloadText() {
    const character = certificate.isMandatory
      ? t('me.training.certificates.print.mandatory')
      : t('me.training.certificates.print.optional');

    const lines = [
      t('me.training.certificates.text.title'),
      t('me.training.certificates.text.platform'),
      '',
      `${t('me.training.certificates.text.holder')}: ${holderName}`,
      `${t('me.training.certificates.text.module')}: ${certificate.moduleTitleFr} (${certificate.moduleCode})`,
      `${t('me.training.certificates.text.character')}: ${character}`,
      `${t('me.training.certificates.text.score')}: ${t('me.training.certificates.print.scoreValue', { score: certificate.score, threshold: certificate.passingScore })}`,
      `${t('me.training.certificates.text.issuedOn')}: ${issuedAt.toLocaleDateString(locale)}`,
      `${t('me.training.certificates.text.reference')}: ${certificate.id}`,
      '',
      t('me.training.certificates.text.disclaimer1'),
      t('me.training.certificates.text.disclaimer2'),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('me.training.certificates.filenamePrefix')}-${certificate.moduleCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn(CARD, 'flex flex-wrap items-start justify-between gap-4 border-status-green/40 p-5')}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-text">{certificate.moduleTitleFr}</h2>
          <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
            {t('me.training.certificates.validatedAt', { score: certificate.score })}
          </span>
          {certificate.isMandatory && (
            <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
              {t('me.training.mandatoryBadge')}
            </span>
          )}
        </div>
        <p className="text-sm text-text-dim">
          {t('me.training.certificates.issuedOn', { date: issuedAt.toLocaleDateString(locale) })}
          {' · '}
          {t('me.training.module.passingThreshold', { score: certificate.passingScore })}
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-text-dim">
          {t('me.training.certificates.reference', { id: certificate.id })}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={print}
          className="rounded-app bg-red-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-light"
        >
          {t('me.training.certificates.printAction')}
        </button>
        <button
          type="button"
          onClick={downloadText}
          className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
        >
          {t('me.training.certificates.textCopyAction')}
        </button>
        <Link
          to={`/app/me/training/${certificate.moduleCode}`}
          className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
        >
          {t('me.training.reviewModule')}
        </Link>
      </div>
    </div>
  );
}

function Figure({ label, value }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-3xl text-red-deep">
        <CountUp value={value} />
      </p>
    </div>
  );
}
