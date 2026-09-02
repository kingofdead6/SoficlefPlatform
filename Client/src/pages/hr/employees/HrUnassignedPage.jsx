import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { assignmentsApi } from '../../../api/organization.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, rowVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/** Older than this, an account has been waiting long enough to be flagged. */
const STALE_DAYS = 3;

/**
 * /app/hr/employees/unassigned (route guide §2.3, CORE).
 * "SI-created accounts awaiting assignment, sorted by age of request so nobody sits in
 * limbo."
 *
 * The sort is the point of the page, so it is not a user preference: the queue is always
 * ordered oldest-first, and the age is rendered with the same emphasis as the name rather
 * than tucked into a corner. `waitingDays` is computed server-side (a duration is a
 * property of the data at the moment it is read), so this page only presents it.
 */
export default function HrUnassignedPage() {
  const [accounts, setAccounts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [pendingRes, requestsRes] = await Promise.all([
          assignmentsApi.pendingAccounts(),
          assignmentsApi.accountRequests(50),
        ]);
        setAccounts(pendingRes.data);
        setRequests(requestsRes.data);
      } catch {
        setError('Impossible de charger la file d’affectation.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Oldest first — the whole reason this queue exists.
  const queue = useMemo(
    () => [...accounts].sort((a, b) => b.waitingDays - a.waitingDays),
    [accounts],
  );

  const stale = queue.filter((account) => account.waitingDays >= STALE_DAYS);
  const openRequests = requests.filter((request) => request.status === 'OPEN');

  if (loading) return <PageLoading label="Chargement de la file d’affectation…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Comptes non affectés"
        subtitle="Les comptes créés par le SI qui attendent une affectation, du plus ancien au plus récent."
        actions={
          <Link
            to="/app/hr/employees/request"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            Demander un compte
          </Link>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            En attente
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={queue.length} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Au-delà de {STALE_DAYS} jours
          </p>
          <p className={`font-display text-3xl ${stale.length > 0 ? 'text-status-red' : 'text-red-deep'}`}>
            <CountUp value={stale.length} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Attente la plus longue
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={queue[0]?.waitingDays ?? 0} suffix=" j" />
          </p>
        </motion.div>
      </motion.div>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl text-text">File d’affectation</h2>
        {queue.length === 0 ? (
          <EmptyState
            title="File vide"
            detail="Aucun compte créé par le SI n’attend d’affectation."
            muted
          />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Collaborateur</th>
                  <th className="px-4 py-3 font-medium">Adresse e-mail</th>
                  <th className="px-4 py-3 font-medium">Compte créé le</th>
                  <th className="px-4 py-3 font-medium">Attente</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer(0.04, 0.2)}
                initial={initialOrNone(reduce)}
                animate="visible"
              >
                {queue.map((account) => (
                  <motion.tr
                    key={account.id}
                    variants={rowVariants}
                    className="border-b border-border last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 font-medium text-text">{account.displayName}</td>
                    <td className="px-4 py-3 text-text-dim">{account.email}</td>
                    <td className="px-4 py-3 text-text-dim">
                      {new Date(account.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          account.waitingDays >= STALE_DAYS
                            ? 'bg-status-red/10 text-status-red'
                            : 'bg-surface-2 text-text-dim'
                        }`}
                      >
                        {account.waitingDays} jour{account.waitingDays > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        to={`/app/hr/employees/${account.id}/assign`}
                        className="rounded-app bg-red-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-light"
                      >
                        Affecter
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl text-text">
          Demandes de compte en cours auprès du SI
        </h2>
        {openRequests.length === 0 ? (
          <EmptyState detail="Aucune demande de compte ouverte." muted />
        ) : (
          <motion.div
            variants={staggerContainer(0.05)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {openRequests.map((request) => (
              <motion.div key={request.id} variants={staggerItem} className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-text">{request.candidateNameFr}</p>
                  {request.urgency === 'URGENT' && (
                    <span className="shrink-0 rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-medium text-status-red">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-dim">{request.plannedPositionFr}</p>
                <p className="mt-2 text-xs text-text-dim">
                  Demandé il y a {request.waitingDays} jour{request.waitingDays > 1 ? 's' : ''}
                  {request.plannedHireDate
                    ? ` — embauche prévue le ${new Date(request.plannedHireDate).toLocaleDateString('fr-FR')}`
                    : ''}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
