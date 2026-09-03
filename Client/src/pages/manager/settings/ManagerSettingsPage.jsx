import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import PageHeader from '../../../components/manager/PageHeader.jsx';
import { sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';

const STORAGE_KEY = 'soficlef.manager.settings.v1';

const DEFAULTS = {
  reminderWindowDays: 7,
  notifyOnBlocked: true,
  notifyOnOverdue: true,
  notifyOnEvaluationDue: true,
  dashboardDensity: 'comfortable',
};

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * /app/manager/settings — additional manager page (not in the PDF route guide; added on
 * request). There is no per-user preferences model in the schema (prisma/schema.prisma's
 * User has no notification/reminder fields, and AppSetting is a global admin table, not
 * per-user) — building real server-persisted settings would mean a schema migration,
 * which is out of scope for "a few more pages". These preferences are therefore
 * genuinely functional but stored in this browser only (localStorage), not synced across
 * devices — the page says so plainly rather than implying a backend that doesn't exist.
 */
export default function ManagerSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    setSettings(load());
  }, []);

  function update(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // Storage unavailable (private browsing, quota) — the UI just won't persist; no
      // error surfaced, since these are conveniences, not data the user must not lose.
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('manager.settings.title')}
        subtitle={t('manager.settings.subtitle')}
      />

      <motion.div
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="max-w-xl space-y-6"
      >
        <div className="rounded-app border border-dashed border-border bg-surface-2 p-3 text-xs text-text-dim">
          {t('manager.settings.deviceOnlyNote')}
        </div>

        <section className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h2 className="mb-4 font-display text-lg text-text">{t('manager.settings.reminders.heading')}</h2>

          <label className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">{t('manager.settings.reminders.windowLabel')}</p>
              <p className="text-xs text-text-dim">{t('manager.settings.reminders.windowHelp')}</p>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              value={settings.reminderWindowDays}
              onChange={(e) => update({ reminderWindowDays: Number(e.target.value) })}
              className="w-20 rounded-app border border-border px-3 py-1.5 text-sm outline-none focus:border-red-brand"
            />
          </label>

          <div className="space-y-3 border-t border-border pt-4">
            <ToggleRow
              label={t('manager.settings.reminders.blockedSteps')}
              checked={settings.notifyOnBlocked}
              onChange={(v) => update({ notifyOnBlocked: v })}
            />
            <ToggleRow
              label={t('manager.settings.reminders.overdueSteps')}
              checked={settings.notifyOnOverdue}
              onChange={(v) => update({ notifyOnOverdue: v })}
            />
            <ToggleRow
              label={t('manager.settings.reminders.evaluationsDue')}
              checked={settings.notifyOnEvaluationDue}
              onChange={(v) => update({ notifyOnEvaluationDue: v })}
            />
          </div>
        </section>

        <section className="rounded-app border border-border bg-surface p-5 shadow-app">
          <h2 className="mb-4 font-display text-lg text-text">{t('manager.settings.display.heading')}</h2>
          <div className="flex gap-2">
            {['comfortable', 'compact'].map((density) => (
              <button
                key={density}
                type="button"
                onClick={() => update({ dashboardDensity: density })}
                className={`rounded-app border px-3 py-1.5 text-sm font-medium transition ${
                  settings.dashboardDensity === density
                    ? 'border-red-brand bg-red-brand/10 text-red-deep'
                    : 'border-border text-text-dim hover:bg-surface-2'
                }`}
              >
                {density === 'comfortable'
                  ? t('manager.settings.display.comfortable')
                  : t('manager.settings.display.compact')}
              </button>
            ))}
          </div>
        </section>

        <p className={`text-xs text-status-green transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
          {t('manager.settings.saved')}
        </p>
      </motion.div>
    </div>
  );
}

/** A labelled row wrapping the shared switch. The label is the switch's accessible name. */
function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
