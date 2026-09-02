import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { auditApi } from '../../../api/audit.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const URGENCY_LABELS = { HIGH: 'Urgent', NORMAL: 'Normal', LOW: 'Peut attendre' };
const URGENCY_PILL = {
  HIGH: 'bg-status-red/10 text-status-red',
  NORMAL: 'bg-surface-2 text-text-dim',
  LOW: 'bg-surface-2 text-text-dim',
};

/**
 * How old is too old. Deliberately a single rule stated once, so the two halves of the
 * handoff are judged by the same clock: a request or an unplaced account past a week is
 * flagged, past a fortnight it is red.
 */
const AGING = { warn: 7, alert: 14 };

function ageTone(days) {
  if (days >= AGING.alert) return 'red';
  if (days >= AGING.warn) return 'amber';
  return 'dim';
}

const AGE_TEXT = {
  red: 'text-status-red',
  amber: 'text-status-amber',
  dim: 'text-text-dim',
};

/**
 * /admin/users/provisioning (route guide §2.4, CORE).
 * "Provisioning queue: account requests from HR waiting to be created, plus created-but-
 * unassigned accounts with their age — the two-sided view of the handoff."
 *
 * The two lists are the two ways the same handoff stalls, and showing them together is the
 * whole point of the page: a request nobody has turned into an account, and an account
 * nobody has turned into a person with a post. Each side carries its own waiting time,
 * computed server-side from the row's creation date, so the queue answers "how long has
 * this been sitting here" rather than merely "what is here".
 *
 * The page is read-and-route: creating the account is /admin/users, placing it is HR's
 * assignment screen. Duplicating either control here would give the same action two
 * different implementations to drift apart.
 */
export default function AdminProvisioningPage() {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await auditApi.provisioning();
      setQueue(data);
      setError(null);
    } catch {
      setError('Impossible de charger la file de provisionnement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!queue) return null;
    const all = [...queue.requests, ...queue.unplaced];
    return {
      requests: queue.requests.length,
      unplaced: queue.unplaced.length,
      aging: all.filter((row) => row.waitingDays >= AGING.warn).length,
      oldest: all.reduce((max, row) => Math.max(max, row.waitingDays), 0),
    };
  }, [queue]);

  if (loading) return <PageLoading label="Chargement de la file…" />;
  if (error) return <PageError message={error} />;

  const { requests, unplaced } = queue;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="File de provisionnement"
        subtitle="Les deux côtés du relais : ce que les RH ont demandé et que le SI n’a pas encore créé, et ce que le SI a créé et que personne n’a encore affecté."
        actions={
          <>
            <button type="button" onClick={load} className={SECONDARY_BUTTON}>
              Actualiser
            </button>
            <Link to="/admin/users" className={PRIMARY_BUTTON}>
              Créer un compte
            </Link>
          </>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label="Demandes RH ouvertes" value={stats.requests} tone={stats.requests > 0 ? 'red' : undefined} />
        <Tile label="Comptes non affectés" value={stats.unplaced} tone={stats.unplaced > 0 ? 'red' : undefined} />
        <Tile label={`En attente > ${AGING.warn} j`} value={stats.aging} tone={stats.aging > 0 ? 'red' : undefined} />
        <Tile label="Attente la plus longue" value={stats.oldest} suffix=" j" />
      </motion.div>

      <div className="grid flex-1 gap-8 lg:grid-cols-2">
        {/* Side 1 — HR asked, SI has not created */}
        <section className="flex flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-text">Demandes en attente de création</h2>
            <span className="text-sm text-text-dim">{requests.length}</span>
          </div>
          <p className="mb-4 text-sm text-text-dim">
            Ouvertes par les RH pour un recrutement à venir. Chacune attend qu’un compte
            soit créé sur la page Comptes.
          </p>

          {requests.length === 0 ? (
            <EmptyState
              muted
              title="Aucune demande en attente"
              detail="Les RH n’ont aucune demande de compte ouverte : rien n’est bloqué de ce côté du relais."
            />
          ) : (
            <motion.div
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="space-y-3"
            >
              {requests.map((request) => {
                const tone = ageTone(request.waitingDays);
                return (
                  <motion.article
                    key={request.id}
                    variants={staggerItem}
                    className={`${CARD} p-4 ${tone === 'red' ? 'border-status-red/40' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text">{request.candidateNameFr}</p>
                        <p className="text-sm text-text-dim">
                          {request.plannedPositionFr ?? 'Poste non précisé'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          URGENCY_PILL[request.urgency] ?? URGENCY_PILL.NORMAL
                        }`}
                      >
                        {URGENCY_LABELS[request.urgency] ?? request.urgency}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                      <Detail label="Demandé par" value={request.requestedBy?.displayName ?? '—'} />
                      <Detail
                        label="Embauche prévue"
                        value={
                          request.plannedHireDate
                            ? new Date(request.plannedHireDate).toLocaleDateString('fr-FR')
                            : 'Non précisée'
                        }
                      />
                      <Detail
                        label="Ouverte le"
                        value={new Date(request.createdAt).toLocaleDateString('fr-FR')}
                      />
                      <div className="flex gap-1">
                        <dt className="text-text-dim">En attente :</dt>
                        <dd className={`font-medium ${AGE_TEXT[tone]}`}>
                          {request.waitingDays} jour(s)
                        </dd>
                      </div>
                    </dl>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </section>

        {/* Side 2 — SI created, nobody placed */}
        <section className="flex flex-col">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-text">Comptes créés, non affectés</h2>
            <span className="text-sm text-text-dim">{unplaced.length}</span>
          </div>
          <p className="mb-4 text-sm text-text-dim">
            Le compte existe et la personne peut se connecter, mais aucun poste ne lui est
            rattaché : ni organigramme, ni parcours d’intégration, ni responsable.
          </p>

          {unplaced.length === 0 ? (
            <EmptyState
              muted
              title="Aucun compte en suspens"
              detail="Tous les comptes créés sont rattachés à un poste."
            />
          ) : (
            <motion.div
              variants={staggerContainer(0.05)}
              initial={initialOrNone(reduce)}
              animate="visible"
              className="space-y-3"
            >
              {unplaced.map((account) => {
                const tone = ageTone(account.waitingDays);
                return (
                  <motion.article
                    key={account.id}
                    variants={staggerItem}
                    className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-4 ${
                      tone === 'red' ? 'border-status-red/40' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-text">{account.displayName}</p>
                      <p className="text-xs text-text-dim">{account.email}</p>
                      <p className="mt-1 text-xs text-text-dim">
                        Créé le {new Date(account.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-medium ${AGE_TEXT[tone]}`}>
                      {account.waitingDays} j
                    </span>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </section>
      </div>

      <p className="mt-8 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        Cette page observe le relais, elle ne l’exécute pas : la création d’un compte se fait
        sur <Link to="/admin/users" className="text-red-brand hover:underline">Comptes</Link>, et
        l’affectation à un poste relève des RH. Aucune relance automatique n’est envoyée —
        aucun planificateur ne tourne dans l’application, et aucun relais SMTP n’est
        raccordé. Les délais ci-dessus sont donc à lire, pas à attendre.
      </p>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand';

function Detail({ label, value }) {
  return (
    <div className="flex gap-1">
      <dt className="text-text-dim">{label} :</dt>
      <dd className="truncate text-text-muted">{value}</dd>
    </div>
  );
}

function Tile({ label, value, suffix = '', tone }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} suffix={suffix} />
      </p>
    </motion.div>
  );
}
