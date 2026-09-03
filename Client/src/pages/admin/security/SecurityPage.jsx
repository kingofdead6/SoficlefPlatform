import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /admin/security (route guide §2.4, LATER).
 * "Password/MFA policy, session duration, encryption status, IP restrictions."
 *
 * Two layers, deliberately distinguished on screen because they disagree by design:
 *
 *  - **En vigueur** — what the running process actually enforces, read from the validated
 *    deployment configuration (GET /admin/security). Not editable here: changing an
 *    environment variable is a deployment act.
 *  - **Politique enregistrée** — the intent recorded in `security_policy`
 *    (GET/PATCH /admin/security/policy). Editable, audited, and consumed by nothing yet.
 *
 * Showing a saved value as though it were in force would be the dangerous version of this
 * screen, so the split is stated rather than smoothed over.
 */
export default function SecurityPage() {
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [stored, setStored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ipText, setIpText] = useState('');
  const reduce = useReducedMotion();

  async function load() {
    try {
      const [reportRes, policyRes] = await Promise.all([adminApi.security(), adminApi.securityPolicy()]);
      setReport(reportRes.data ?? reportRes);
      setPolicy(policyRes.data);
      setStored(Boolean(policyRes.stored));
      setIpText((policyRes.data.ipAllowlist ?? []).join('\n'));
    } catch {
      setError(t('admin.security.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function savePolicy(patch) {
    setSaving(true);
    try {
      await adminApi.updateSecurityPolicy(patch);
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      setError(t('admin.security.recordedPolicy.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading label={t('admin.security.loading')} />;
  if (error && !report) return <PageError message={error} />;
  if (!report || !policy) return null;

  const tiles = [
    { label: t('admin.security.tiles.activeSessions'), value: report.activeSessions },
    { label: t('admin.security.tiles.revokedSessions'), value: report.revokedSessions },
    { label: t('admin.security.tiles.failedLogins24h'), value: report.failedLogins24h },
    { label: t('admin.security.tiles.sessionDuration'), value: report.sessionTtlHours, suffix: ' h' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t('admin.security.eyebrow')}
        title={t('admin.security.title')}
        subtitle={t('admin.security.subtitle')}
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {tiles.map((tile) => (
          <motion.div key={tile.label} variants={staggerItem} className={`${CARD} p-5`}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{tile.label}</p>
            <p className="font-display text-3xl text-red-deep">
              <CountUp value={tile.value ?? 0} suffix={tile.suffix ?? ''} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">{t('admin.security.inEffect.title')}</h2>
        <p className="mb-4 text-sm text-text-dim">{t('admin.security.inEffect.subtitle')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${CARD} p-4`}>
            <p className="text-sm font-medium text-text">{t('admin.security.inEffect.passwords')}</p>
            <p className="mt-1 text-sm text-text-dim">
              {t('admin.security.inEffect.passwordsDetail', { length: report.passwordMinLength })}
            </p>
            <p className="mt-2 font-mono text-[11px] text-text-dim">
              {t('admin.security.inEffect.argon2Detail', {
                memory: report.argon2?.memoryKib,
                iterations: report.argon2?.iterations,
                parallelism: report.argon2?.parallelism,
              })}
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-medium text-text">{t('admin.security.inEffect.sessions')}</p>
            <p className="mt-1 text-sm text-text-dim">
              {t('admin.security.inEffect.sessionsDetail', {
                hours: report.sessionTtlHours,
                minutes: report.sessionRenewWindowMinutes,
              })}
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-medium text-text">{t('admin.security.inEffect.encryption')}</p>
            <p className="mt-1 text-sm text-text-dim">{t('admin.security.inEffect.encryptionDetail')}</p>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-medium text-text">{t('admin.security.inEffect.replayProtection')}</p>
            <p className="mt-1 text-sm text-text-dim">{t('admin.security.inEffect.replayProtectionDetail')}</p>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.08 }}
      >
        <h2 className="mb-1 font-display text-xl text-text">{t('admin.security.recordedPolicy.title')}</h2>
        <p className="mb-4 max-w-2xl text-sm text-text-dim">
          <Trans i18nKey="admin.security.recordedPolicy.subtitle">
            Cette politique est enregistrée et journalisée, mais <strong>aucun composant ne la
            lit encore</strong> : elle exprime une intention, pas une contrainte appliquée. Les
            valeurs réellement en vigueur restent celles du bloc ci-dessus.
          </Trans>
          {!stored && t('admin.security.recordedPolicy.neverSavedNote')}
        </p>

        <div className={`${CARD} max-w-2xl space-y-5 p-5`}>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-text">{t('admin.security.recordedPolicy.minLength')}</span>
              <span className="block text-xs text-text-dim">{t('admin.security.recordedPolicy.minLengthHint')}</span>
            </span>
            <input
              type="number"
              min={8}
              max={128}
              defaultValue={policy.passwordMinLength}
              disabled={saving}
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (next !== policy.passwordMinLength) savePolicy({ passwordMinLength: next });
              }}
              className={`${field} w-24`}
            />
          </label>

          {/* A <div>, not a <label>: a label cannot caption a <button>, and wrapping one
              neither forwards the click nor names the control. The switch carries its own
              accessible name instead. */}
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span>
              <span className="block text-sm font-medium text-text">{t('admin.security.recordedPolicy.mfaRequired')}</span>
              <span className="block text-xs text-text-dim">{t('admin.security.recordedPolicy.mfaRequiredHint')}</span>
            </span>
            <Toggle
              checked={policy.mfaRequired}
              disabled={saving}
              onChange={(next) => savePolicy({ mfaRequired: next })}
              label={t('admin.security.recordedPolicy.mfaRequired')}
            />
          </div>

          <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span>
              <span className="block text-sm font-medium text-text">{t('admin.security.recordedPolicy.sessionDuration')}</span>
              <span className="block text-xs text-text-dim">{t('admin.security.recordedPolicy.sessionDurationHint')}</span>
            </span>
            <input
              type="number"
              min={1}
              max={720}
              defaultValue={Math.round(policy.sessionTtlSeconds / 3600)}
              disabled={saving}
              onBlur={(e) => {
                const seconds = Number(e.target.value) * 3600;
                if (seconds !== policy.sessionTtlSeconds) savePolicy({ sessionTtlSeconds: seconds });
              }}
              className={`${field} w-24`}
            />
          </label>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-text">{t('admin.security.recordedPolicy.ipAllowlist')}</p>
            <p className="mb-2 text-xs text-text-dim">{t('admin.security.recordedPolicy.ipAllowlistHint')}</p>
            <textarea
              rows={4}
              value={ipText}
              disabled={saving}
              onChange={(e) => setIpText(e.target.value)}
              onBlur={() => {
                const list = ipText.split('\n').map((line) => line.trim()).filter(Boolean);
                if (list.join('\n') !== (policy.ipAllowlist ?? []).join('\n')) {
                  savePolicy({ ipAllowlist: list });
                }
              }}
              placeholder={t('admin.security.recordedPolicy.ipAllowlistPlaceholder')}
              className={`${field} w-full font-mono text-xs`}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-text-dim">
              {policy.updatedAt
                ? t('admin.security.recordedPolicy.lastModified', { date: new Date(policy.updatedAt).toLocaleString(localeOf(i18n)) })
                : t('admin.security.recordedPolicy.neverModified')}
            </span>
            <span className={`text-xs text-status-green transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
              {t('admin.security.recordedPolicy.saved')}
            </span>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-status-red">{error}</p>}
      </motion.section>
    </div>
  );
}
