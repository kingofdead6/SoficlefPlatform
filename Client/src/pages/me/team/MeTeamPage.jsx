import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { usersApi } from '../../../api/users.js';
import { ApiError } from '../../../api/client.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import Avatar from '../../../components/me/Avatar.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * The four key services §2.1 names, matched against each contact's declared role.
 *
 * The `Contact` table has a free-text `roleFr` and a two-level priority rank, but no service
 * column, so the grouping is done by matching that text. A contact matching none of the four
 * still appears, under "Autres contacts" — dropping a published contact because its wording
 * did not match a regex would be the worst possible failure for a page whose whole job is
 * "who do I call".
 */
const SERVICES = [
  { id: 'hr', labelKey: 'me.team.services.hr', match: /rh|ressources humaines|personnel|emploi|paie|recrutement/i },
  { id: 'it', labelKey: 'me.team.services.it', match: /informatique|it\b|si\b|système|reseau|réseau|support/i },
  { id: 'hse', labelKey: 'me.team.services.hse', match: /hse|securite|sécurité|hygiene|hygiène|environnement/i },
  { id: 'quality', labelKey: 'me.team.services.quality', match: /qualite|qualité|smq|audit|conformite|conformité/i },
];

/**
 * /app/me/team — Mon équipe (route guide §2.1, SITE).
 * "Manager card, peers, key contacts (HR, IT, HSE, Quality)."
 *
 * Backed by GET /users/me/team, which resolves everything from the caller's own id: their
 * manager, the holders of the posts sharing their own post's parent (their structural peers,
 * with themselves excluded), and the published contact directory. No parameter on that
 * endpoint can name another person, so this page has no way to show somebody else's team.
 *
 * The page also carries the profile-photo upload (POST /users/me/avatar), because this is
 * where a recruit sees their own photo used — on the cards, and on the org-chart card §2.1
 * asks for. Without Cloudinary credentials the server answers 501 and its message is shown
 * as-is rather than a generic failure.
 */
export default function MeTeamPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  const avatarInput = useRef(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await usersApi.myTeam();
      setTeam(data);
    } catch {
      setError(t('me.team.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    [loading, team],
  );

  const groupedContacts = useMemo(() => {
    const contacts = team?.contacts ?? [];
    const claimed = new Set();

    const groups = SERVICES.map((service) => {
      const rows = contacts.filter((contact) => {
        if (claimed.has(contact.id)) return false;
        if (!service.match.test(contact.roleFr)) return false;
        claimed.add(contact.id);
        return true;
      });
      return { ...service, contacts: rows };
    }).filter((group) => group.contacts.length > 0);

    const rest = contacts.filter((contact) => !claimed.has(contact.id));
    if (rest.length > 0) {
      groups.push({ id: 'others', labelKey: 'me.team.services.others', contacts: rest });
    }

    return groups;
  }, [team]);

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setNotice(null);
    try {
      const { avatarUrl } = await usersApi.uploadMyAvatar(file);
      setMyAvatarUrl(avatarUrl);
      await refresh();
      setNotice({ tone: 'ok', text: t('me.team.avatar.uploadSuccess') });
    } catch (err) {
      setNotice({
        tone: 'error',
        text:
          err instanceof ApiError && err.body?.message
            ? err.body.message
            : t('me.team.avatar.uploadFailed'),
      });
    } finally {
      setUploading(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  }

  if (loading) return <PageLoading label={t('me.team.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.team.title')}
        subtitle={t('me.team.subtitle')}
        actions={
          <Link
            to="/app/me/organigram"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('me.organigram.title')}
          </Link>
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

      {/* Band 1 — me, my manager, and the counts. */}
      <div data-gsap="band" className="mb-10 grid gap-4 lg:grid-cols-3">
        <div className={`${CARD} p-5`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{t('me.team.me')}</p>
          <div className="flex items-center gap-4">
            <Avatar name={user?.displayName} url={myAvatarUrl ?? user?.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{user?.displayName}</p>
              <p className="truncate text-sm text-text-dim">
                {team?.myPosition?.titleFr ?? t('me.team.positionUnassigned')}
              </p>
              <p className="truncate text-xs text-text-dim">
                {team?.myPosition?.organizationUnitNameFr ?? '—'}
              </p>
            </div>
          </div>

          <label className="mt-4 block text-xs text-text-dim">
            {t('me.team.avatar.label')}
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={uploadAvatar}
              className="mt-1 w-full text-xs text-text-dim file:mr-3 file:rounded-app file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-text disabled:opacity-50"
            />
          </label>
          {uploading && <p className="mt-1 text-xs text-text-dim">{t('me.team.avatar.uploading')}</p>}
        </div>

        <div className={`${CARD} p-5 lg:col-span-2`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{t('me.team.myManager')}</p>
          {team?.manager ? (
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={team.manager.displayName} url={team.manager.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl text-red-deep">{team.manager.displayName}</p>
                <p className="text-sm text-text-dim">
                  {team.manager.positionTitleFr ?? t('me.team.positionNotSpecified')}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {team.manager.email && (
                    <a href={`mailto:${team.manager.email}`} className="text-red-brand hover:underline">
                      {team.manager.email}
                    </a>
                  )}
                  {team.manager.phone && (
                    <span className="text-text-dim">{t('me.team.extension', { extension: team.manager.phone })}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState detail={t('me.team.noManager')} muted />
          )}
        </div>
      </div>

      {/* Band 2 — peers. */}
      <motion.section
        data-gsap="band"
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-text">{t('me.team.peers.heading')}</h2>
          <span className="text-sm text-text-dim">
            <CountUp value={team?.peers?.length ?? 0} />
          </span>
        </div>
        <p className="mb-4 text-xs text-text-dim">{t('me.team.peers.subtitle')}</p>

        {(team?.peers?.length ?? 0) === 0 ? (
          <EmptyState detail={t('me.team.peers.empty')} muted />
        ) : (
          <motion.ul
            variants={staggerContainer(0.05, 0.15)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {team.peers.map((peer) => (
              <motion.li
                key={peer.id}
                variants={staggerItem}
                whileHover={reduce ? undefined : { y: -3, boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`${CARD} p-4`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={peer.displayName} url={peer.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{peer.displayName}</p>
                    <p className="truncate text-xs text-text-dim">{peer.positionTitleFr}</p>
                    <p className="truncate text-xs text-text-dim">{peer.organizationUnitNameFr ?? '—'}</p>
                    {peer.email && (
                      <a
                        href={`mailto:${peer.email}`}
                        className="mt-1 block truncate text-xs text-red-brand hover:underline"
                      >
                        {peer.email}
                      </a>
                    )}
                    {peer.phone && (
                      <p className="text-xs text-text-dim">{t('me.team.extension', { extension: peer.phone })}</p>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </motion.section>

      {/* Band 3 — key contacts, grouped by service. */}
      <motion.section
        data-gsap="band"
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="flex-1"
      >
        <h2 className="font-display text-xl text-text">{t('me.team.contacts.heading')}</h2>
        <p className="mb-6 text-xs text-text-dim">{t('me.team.contacts.subtitle')}</p>

        {groupedContacts.length === 0 ? (
          <EmptyState detail={t('me.team.contacts.empty')} muted />
        ) : (
          <div className="space-y-8">
            {groupedContacts.map((group) => (
              <div key={group.id}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-red-brand">
                  {t(group.labelKey)}
                </h3>
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial={initialOrNone(reduce)}
                  animate="visible"
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {group.contacts.map((contact) => (
                    <motion.li key={contact.id} variants={staggerItem} className={`${CARD} p-4`}>
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-brand/15 text-[11px] font-semibold text-red-deep">
                          {contact.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-text">{contact.nameFr}</p>
                          <p className="truncate text-xs text-text-dim">{contact.roleFr}</p>
                          <p className="mt-1 font-mono text-xs text-text">
                            {t('me.team.extension', { extension: contact.extension })}
                          </p>
                          {contact.priorityFr && (
                            <p className="mt-1 text-[11px] text-text-dim">{contact.priorityFr}</p>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
