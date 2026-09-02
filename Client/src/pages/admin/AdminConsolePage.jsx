import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { auditApi } from '../../api/audit.js';
import { adminApi } from '../../api/admin.js';
import PageHeader from '../../components/manager/PageHeader.jsx';
import CountUp from '../../components/manager/CountUp.jsx';
import ProgressRing from '../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const SECTION_TITLE = 'font-display text-xl text-text';

const MODE_LABELS = {
  production: { label: 'Production', tone: 'green' },
  mock: { label: 'Simulé', tone: 'brand' },
  unconfigured: { label: 'Non configuré', tone: 'red' },
};

const TONE_PILL = {
  green: 'bg-status-green/10 text-status-green',
  brand: 'bg-red-brand/10 text-red-brand',
  red: 'bg-status-red/10 text-status-red',
  dim: 'bg-surface-2 text-text-dim',
};

/** Byte counts are only meaningful once they carry their unit. */
function shortAgent(userAgent) {
  if (!userAgent) return 'Client inconnu';
  const browser =
    /Firefox\/\d+/.exec(userAgent)?.[0] ??
    /Edg\/\d+/.exec(userAgent)?.[0] ??
    /Chrome\/\d+/.exec(userAgent)?.[0] ??
    /Safari\/\d+/.exec(userAgent)?.[0] ??
    null;
  return browser ?? `${userAgent.slice(0, 28)}…`;
}

/**
 * /admin — the administrator's console (route guide §2.4, SITE).
 * "Console: system health, active sessions, connector status, error rate, storage."
 *
 * Everything shown is measured rather than declared: sessions are counted rows, the error
 * rate comes from the audit trail's `access.denied` and `auth.login_failed` entries over
 * the last 24 hours, and a connector's mode is read from the environment the server is
 * actually running with. Nothing on this page is a status light someone set by hand.
 *
 * Motion: GSAP orchestrates the bands' load-in, anime.js drives the figures' count-ups and
 * the health ring, Framer handles list stagger — the same language as the manager
 * dashboard, so the two portals read as one product.
 */
export default function AdminConsolePage() {
  const [console_, setConsole] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [consoleRes, sessionsRes] = await Promise.all([
          auditApi.console(),
          auditApi.sessions(8),
        ]);
        setConsole(consoleRes.data);
        setSessions(sessionsRes.data ?? []);

        // The declared connector modes are a separate, optional read: the console must
        // still render if the connector table has never been written to.
        try {
          const declared = await adminApi.connectors();
          setConnectors(declared.data ?? []);
        } catch {
          setConnectors([]);
        }
      } catch {
        setError('Impossible de charger la console d’administration.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 24 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 });
    },
    [loading, console_],
  );

  /**
   * A single "santé" figure has to mean something specific or it is decoration. Here it is
   * the share of the last 24 hours' authenticated traffic that did *not* end in a refusal:
   * successful sessions against successful sessions plus failed logins plus denied
   * accesses. With no traffic at all the answer is 100 % — nothing has gone wrong — and the
   * caption says which it is.
   */
  const health = useMemo(() => {
    if (!console_) return null;
    const bad = console_.failedLogins24h + console_.accessDenied24h;
    const total = console_.sessionsLast24h + bad;
    return {
      percent: total === 0 ? 100 : Math.round((console_.sessionsLast24h / total) * 100),
      errors: bad,
      observed: total,
    };
  }, [console_]);

  if (loading) return <PageLoading label="Chargement de la console…" />;
  if (error) return <PageError message={error} />;

  const unconfigured = console_.connectors.filter((row) => row.mode === 'unconfigured');
  const mismatched = connectors.filter((row) => row.envMismatch);

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="Console"
        subtitle="État réel du système : sessions ouvertes, refus d’accès, connecteurs raccordés et volumes stockés."
        actions={
          <>
            <Link
              to="/admin/audit"
              className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
            >
              Journal d’audit
            </Link>
            <Link
              to="/admin/users/provisioning"
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              File de provisionnement
            </Link>
          </>
        }
      />

      {/* Band 1 — the headline figures */}
      <div data-gsap="band" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Sessions actives" value={console_.activeSessions} />
        <Tile label="Personnes connectées" value={console_.distinctUsersOnline} />
        <Tile
          label="Connexions refusées (24 h)"
          value={console_.failedLogins24h}
          tone={console_.failedLogins24h > 0 ? 'red' : undefined}
        />
        <Tile
          label="Accès refusés (24 h)"
          value={console_.accessDenied24h}
          tone={console_.accessDenied24h > 0 ? 'red' : undefined}
        />
      </div>

      {/* Band 2 — health ring, accounts, storage */}
      <div data-gsap="band" className="mb-10 grid gap-8 lg:grid-cols-3">
        <section className={`${CARD} flex items-center gap-5 p-6`}>
          <ProgressRing
            percent={health.percent}
            tone={health.errors > 0 ? 'red' : 'green'}
            label={`${health.percent}%`}
          />
          <div className="min-w-0">
            <h2 className="font-display text-lg text-text">Santé applicative</h2>
            <p className="mt-1 text-sm text-text-dim">
              {health.observed === 0
                ? 'Aucune tentative d’accès depuis 24 heures : rien à signaler, faute de trafic à mesurer.'
                : `${console_.sessionsLast24h} session(s) ouverte(s) contre ${health.errors} refus sur les 24 dernières heures.`}
            </p>
          </div>
        </section>

        <section className={`${CARD} p-6`}>
          <h2 className="mb-4 font-display text-lg text-text">Comptes</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Actifs" value={console_.accountsActive} />
            <Row label="Créés, non affectés" value={console_.accountsPending} accent={console_.accountsPending > 0} />
            <Row label="Suspendus ou désactivés" value={console_.accountsSuspended} />
            <Row label="Demandes RH ouvertes" value={console_.openAccountRequests} accent={console_.openAccountRequests > 0} />
          </dl>
          <Link
            to="/admin/users"
            className="mt-4 inline-block text-xs font-medium text-red-brand hover:underline"
          >
            Gérer les comptes →
          </Link>
        </section>

        <section className={`${CARD} p-6`}>
          <h2 className="mb-4 font-display text-lg text-text">Stockage</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Documents référencés" value={console_.storedDocuments} />
            <Row label="Pièces administratives" value={console_.storedFiles} />
            <Row label="Entrées d’audit" value={console_.auditRows} />
          </dl>
          <p className="mt-4 text-xs text-text-dim">
            Ces nombres comptent des lignes, pas des octets : aucun connecteur de stockage
            n’est raccordé, les fichiers sont donc suivis sans être hébergés ici.
          </p>
        </section>
      </div>

      {/* Band 3 — connectors + live sessions */}
      <div data-gsap="band" className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Connecteurs</h2>
            <Link to="/admin/integrations" className="text-xs font-medium text-red-brand hover:underline">
              Configurer →
            </Link>
          </div>

          <motion.div
            variants={staggerContainer(0.05)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="space-y-2"
          >
            {console_.connectors.map((row) => {
              const mode = MODE_LABELS[row.mode] ?? MODE_LABELS.unconfigured;
              const declared = connectors.find((entry) => entry.key === row.definition.id);
              return (
                <motion.div
                  key={row.definition.id}
                  variants={staggerItem}
                  className={`${CARD} flex items-center justify-between gap-3 p-4`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{row.definition.labelFr}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-text-dim">{row.definition.envVar}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_PILL[mode.tone]}`}>
                      {mode.label}
                    </span>
                    {declared?.envMismatch && (
                      <span className="text-[10px] font-medium text-status-red">
                        Déclaré en production
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {(unconfigured.length > 0 || mismatched.length > 0) && (
            <div className="mt-3 space-y-2">
              {unconfigured.length > 0 && (
                <EmptyState
                  muted
                  title={`${unconfigured.length} connecteur(s) non configuré(s)`}
                  detail="Un connecteur non configuré n’est pas une panne : rien ne l’a jamais été raccordé. Chaque écran concerné indique ce que cela empêche concrètement."
                />
              )}
              {mismatched.length > 0 && (
                <div className="rounded-app border border-status-red/30 bg-status-red/5 p-4 text-sm text-status-red">
                  {mismatched.length} connecteur(s) sont déclarés en production dans la
                  configuration mais n’ont aucune adresse dans l’environnement du serveur.
                  Le mode déclaré ne suffit pas à raccorder un système.
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className={SECTION_TITLE}>Sessions ouvertes</h2>
            <span className="text-sm text-text-dim">{sessions.length}</span>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              muted
              title="Aucune session ouverte"
              detail="Personne n’est connecté à la plateforme en ce moment, votre propre session mise à part si elle vient d’expirer côté serveur."
            />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                    <th className="px-4 py-3 font-medium">Compte</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Vue le</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <p className="text-text">{session.user.displayName}</p>
                        <p className="text-xs text-text-dim">{session.ip ?? 'IP inconnue'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-dim">{shortAgent(session.userAgent)}</td>
                      <td className="px-4 py-3 text-xs text-text-dim">
                        {new Date(session.lastSeenAt).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-text-dim">
            Dernière activité enregistrée dans le journal :{' '}
            {console_.lastActivityAt
              ? new Date(console_.lastActivityAt).toLocaleString('fr-FR')
              : 'aucune'}
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, suffix = '', tone }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} suffix={suffix} />
      </p>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-dim">{label}</dt>
      <dd className={`font-mono text-sm ${accent ? 'text-status-red' : 'text-text'}`}>{value}</dd>
    </div>
  );
}
