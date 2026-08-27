import { describe, expect, it, vi } from 'vitest';

/**
 * The administrable settings, and the clamp around them.
 *
 * `AppSetting.value` is JSON, so anything can end up in it: a hand-edited row, a bug in
 * the administration screen, a migration that wrote a string. These parameters feed the
 * depth of a recursive query, where an absurd value is not a cosmetic problem — it is a
 * query that walks the whole company.
 */

const findUnique = vi.hoisted(() => vi.fn());
vi.mock('@/infrastructure/db/client', () => ({
  prisma: { appSetting: { findUnique } },
}));

const { SETTING_KEYS, booleanSetting, numberSetting } = await import(
  '@/infrastructure/settings/app-settings'
);

const stored = (value: unknown) => findUnique.mockResolvedValue({ value });

describe('numberSetting', () => {
  it('returns the stored value when it is a sane number', async () => {
    stored(4);
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(4);
  });

  it('falls back to the documented default when the row is missing', async () => {
    findUnique.mockResolvedValue(null);
    // A missing setting means "use the default", never "fail" — an unconfigured platform
    // must still start.
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(2);
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthDown)).resolves.toBe(1);
  });

  it('falls back when the stored value is not a number at all', async () => {
    for (const junk of ['3', null, {}, [], true]) {
      stored(junk);
      await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(2);
    }
  });

  it('clamps a negative depth to zero rather than passing it to SQL', async () => {
    stored(-5);
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(0);
  });

  it('caps an absurd depth at the ceiling the caller sets', async () => {
    stored(10_000);
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp, { max: 12 })).resolves.toBe(12);
  });

  it('floors a fractional depth — a recursive walk counts in whole levels', async () => {
    stored(2.9);
    await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(2);
  });

  it('falls back on a non-finite value', async () => {
    for (const junk of [Number.NaN, Number.POSITIVE_INFINITY]) {
      stored(junk);
      await expect(numberSetting(SETTING_KEYS.orgTreeDepthUp)).resolves.toBe(2);
    }
  });
});

describe('booleanSetting', () => {
  it('returns the stored boolean', async () => {
    stored(false);
    await expect(booleanSetting(SETTING_KEYS.orgTreeShowPeers)).resolves.toBe(false);
  });

  it('falls back to the default for a missing row or a non-boolean', async () => {
    findUnique.mockResolvedValue(null);
    await expect(booleanSetting(SETTING_KEYS.orgTreeShowPeers)).resolves.toBe(true);

    stored('false');
    // A JSON string is not a boolean. Coercing "false" to `true` would be worse than
    // ignoring it, so the default wins.
    await expect(booleanSetting(SETTING_KEYS.orgTreeShowPeers)).resolves.toBe(true);
  });
});
