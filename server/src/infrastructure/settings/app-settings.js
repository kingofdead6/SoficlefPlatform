import { prisma } from '../db/client.js';

/**
 * Administrable parameters, read from `AppSetting` rather than hardcoded.
 * Ported from SoficlefPlatform src/infrastructure/settings/app-settings.ts.
 *
 * The values here are the ones the business is expected to tune without a deploy. Each
 * has a fallback, because a missing row must not take the platform down — an
 * unconfigured setting means "use the documented default", not "fail".
 *
 * Reads are not cached beyond the current call; a setting changed through the
 * administration screen takes effect on the next request.
 */

export const SETTING_KEYS = {
  /** How far *up* the reporting line a collaborator may see. */
  orgTreeDepthUp: 'org.tree.depth.up',
  /** How far *down* the reporting line a collaborator may see. */
  orgTreeDepthDown: 'org.tree.depth.down',
  /** Whether a collaborator sees the peers who share their manager. */
  orgTreeShowPeers: 'org.tree.showPeers',
};

const DEFAULTS = {
  [SETTING_KEYS.orgTreeDepthUp]: 2,
  [SETTING_KEYS.orgTreeDepthDown]: 1,
  [SETTING_KEYS.orgTreeShowPeers]: true,
};

const LABELS_FR = {
  [SETTING_KEYS.orgTreeDepthUp]: "Profondeur de l'organigramme visible vers le haut",
  [SETTING_KEYS.orgTreeDepthDown]: "Profondeur de l'organigramme visible vers le bas",
  [SETTING_KEYS.orgTreeShowPeers]: "Afficher les pairs dans l'organigramme",
};

async function readSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value ?? undefined;
}

/**
 * A whole-number setting, clamped to a sane range.
 *
 * The clamp is not defensive noise: `value` is JSON, so an administration screen bug or a
 * hand-edited row can put a string, a negative or a huge number in it, and an unbounded
 * depth here becomes an unbounded recursive query.
 */
export async function numberSetting(key, options = {}) {
  const fallback = Number(DEFAULTS[key] ?? 0);
  const raw = await readSetting(key);
  const value = typeof raw === 'number' ? raw : fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(Math.floor(value), options.max ?? 32));
}

export async function booleanSetting(key) {
  const raw = await readSetting(key);
  return typeof raw === 'boolean' ? raw : Boolean(DEFAULTS[key]);
}

/** All settings as a flat list, with their current effective value (row value or default). */
export async function listSettings() {
  const rows = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const keys = new Set([...Object.values(SETTING_KEYS), ...byKey.keys()]);
  return Array.from(keys).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      value: row?.value ?? DEFAULTS[key] ?? null,
      labelFr: row?.labelFr ?? LABELS_FR[key] ?? key,
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Upsert a setting's raw JSON value. */
export async function setSetting(key, value) {
  const labelFr = LABELS_FR[key] ?? key;
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, labelFr },
    update: { value },
  });
}
