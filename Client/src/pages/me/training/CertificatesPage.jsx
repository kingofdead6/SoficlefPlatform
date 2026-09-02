import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { trainingApi } from '../../../api/training.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
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
        setError('Impossible de charger vos attestations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(
    () => ({
      total: certificates.length,
      mandatory: certificates.filter((row) => row.isMandatory).length,
      lastAt: certificates[0]?.certifiedAt ?? null,
    }),
    [certificates],
  );

  if (loading) return <PageLoading label="Chargement de vos attestations…" />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Ma formation"
        title="Mes attestations"
        subtitle="Les modules que vous avez validés, avec leur date de délivrance."
        actions={
          <Link
            to="/app/me/training"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            Retour aux modules
          </Link>
        }
      />

      {certificates.length === 0 ? (
        <EmptyState
          title="Aucune attestation pour l’instant"
          detail="Une attestation est délivrée à la première réussite d’un module. Validez un module pour en obtenir une."
          muted
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Figure label="Attestations" value={summary.total} />
            <Figure label="Dont modules obligatoires" value={summary.mandatory} />
            <div className={`${CARD} p-5`}>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">Dernière délivrance</p>
              <p className="font-display text-2xl text-red-deep">
                {summary.lastAt ? new Date(summary.lastAt).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
          </div>

          <p className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs leading-relaxed text-text-dim">
            Les attestations produites ici sont des documents imprimables générés par votre navigateur. Elles ne
            sont <strong className="font-medium text-text-muted">ni signées électroniquement, ni vérifiables</strong> par
            un tiers : la plateforme ne dispose d’aucune autorité de certification. La référence qui fait foi est
            l’identifiant de tentative indiqué sur chaque attestation, que les RH peuvent retrouver dans la
            plateforme.
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
  const issuedAt = new Date(certificate.certifiedAt);

  /**
   * The printable view. Opened in a new window rather than rendered inline so the browser's
   * own print dialog (and its "save as PDF") does the file production — the platform makes
   * no claim about the resulting file beyond what the page itself says.
   */
  function print() {
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return;

    const escape = (value) =>
      String(value ?? '').replace(/[&<>"']/g, (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
      );

    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Attestation — ${escape(certificate.moduleTitleFr)}</title>
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
<h1>Attestation de formation</h1>
<p>Délivrée par la plateforme d’intégration Soficlef.</p>
<h2>${escape(holderName)}</h2>
<p>a validé le module de formation suivant :</p>
<dl>
  <dt>Module</dt><dd>${escape(certificate.moduleTitleFr)} (${escape(certificate.moduleCode)})</dd>
  <dt>Caractère</dt><dd>${certificate.isMandatory ? 'Obligatoire' : 'Facultatif'}</dd>
  <dt>Score obtenu</dt><dd>${escape(certificate.score)} % — seuil de réussite ${escape(certificate.passingScore)} %</dd>
  <dt>Date de délivrance</dt><dd>${escape(issuedAt.toLocaleDateString('fr-FR'))}</dd>
  <dt>Référence de la tentative</dt><dd class="ref">${escape(certificate.id)}</dd>
</dl>
<p class="note">Ce document est une attestation imprimée depuis la plateforme. Il n’est ni signé
électroniquement, ni vérifiable par un tiers : la plateforme ne dispose pas d’autorité de certification.
La référence de tentative ci-dessus est l’élément que le service des ressources humaines peut retrouver
dans les enregistrements de la plateforme.</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  /** A plain-text copy, for anyone who needs to paste the facts rather than print them. */
  function downloadText() {
    const lines = [
      'ATTESTATION DE FORMATION',
      'Plateforme d’intégration Soficlef',
      '',
      `Titulaire         : ${holderName}`,
      `Module            : ${certificate.moduleTitleFr} (${certificate.moduleCode})`,
      `Caractère         : ${certificate.isMandatory ? 'Obligatoire' : 'Facultatif'}`,
      `Score obtenu      : ${certificate.score} % (seuil ${certificate.passingScore} %)`,
      `Date de délivrance: ${issuedAt.toLocaleDateString('fr-FR')}`,
      `Référence         : ${certificate.id}`,
      '',
      'Ce document n’est ni signé électroniquement, ni vérifiable par un tiers.',
      'La référence ci-dessus est l’élément retrouvable par le service RH.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attestation-${certificate.moduleCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn(CARD, 'flex flex-wrap items-start justify-between gap-4 border-status-green/40 p-5')}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-text">{certificate.moduleTitleFr}</h2>
          <span className="rounded-full bg-status-green/10 px-2 py-0.5 text-xs font-medium text-status-green">
            Validé à {certificate.score} %
          </span>
          {certificate.isMandatory && (
            <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
              Obligatoire
            </span>
          )}
        </div>
        <p className="text-sm text-text-dim">
          Délivrée le {issuedAt.toLocaleDateString('fr-FR')} · seuil de réussite {certificate.passingScore} %
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-text-dim">Référence : {certificate.id}</p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={print}
          className="rounded-app bg-red-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-light"
        >
          Imprimer / enregistrer
        </button>
        <button
          type="button"
          onClick={downloadText}
          className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
        >
          Copie texte
        </button>
        <Link
          to={`/app/me/training/${certificate.moduleCode}`}
          className="rounded-app border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
        >
          Revoir le module
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
