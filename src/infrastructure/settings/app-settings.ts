import 'server-only';

import { prisma } from '../db/client';

/**
 * Administrable parameters, read from `AppSetting` rather than hardcoded.
 *
 * The values here are the ones the business is expected to tune without a deploy. Each
 * has a fallback, because a missing row must not take the platform down — an
 * unconfigured setting means "use the documented default", not "fail".
 *
 * Reads are cached for the lifetime of a request only. A setting changed through the
 * administration screen takes effect on the next request, which is the same promise
 * session revocation makes (ADR-011); caching it longer would make the admin screen lie.
 */

export const SETTING_KEYS = {
  /** How far *up* the reporting line a collaborator may see. */
  orgTreeDepthUp: 'org.tree.depth.up',
  /** How far *down* the reporting line a collaborator may see. */
  orgTreeDepthDown: 'org.tree.depth.down',
  /** Whether a collaborator sees the peers who share their manager. */
  orgTreeShowPeers: 'org.tree.showPeers',
} as const;

const DEFAULTS: Record<string, number | boolean> = {
  [SETTING_KEYS.orgTreeDepthUp]: 2,
  [SETTING_KEYS.orgTreeDepthDown]: 1,
  [SETTING_KEYS.orgTreeShowPeers]: true,
};

async function readSetting(key: string): Promise<unknown> {
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
export async function numberSetting(key: string, options: { max?: number } = {}): Promise<number> {
  const fallback = Number(DEFAULTS[key] ?? 0);
  const raw = await readSetting(key);
  const value = typeof raw === 'number' ? raw : fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(Math.floor(value), options.max ?? 32));
}

export async function booleanSetting(key: string): Promise<boolean> {
  const raw = await readSetting(key);
  return typeof raw === 'boolean' ? raw : Boolean(DEFAULTS[key]);
}
