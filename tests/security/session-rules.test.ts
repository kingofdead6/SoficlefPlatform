import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SESSION_POLICY,
  evaluateSession,
  nextExpiry,
  shouldRenew,
} from '@/domain/auth/session-rules';
import { redactForAudit } from '@/domain/audit/actions';
import { checkPassword, DEFAULT_PASSWORD_POLICY } from '@/domain/auth/password-policy';

describe('session lifetime', () => {
  const now = new Date('2026-06-07T08:00:00Z');

  it('refuses a revoked session, and says so', () => {
    const verdict = evaluateSession(
      { expiresAt: new Date('2026-06-07T20:00:00Z'), revokedAt: now, lastSeenAt: now },
      now,
    );
    expect(verdict).toEqual({ valid: false, reason: 'revoked' });
  });

  it('refuses a revoked session even when it has not expired', () => {
    // Revocation is checked first, so the reported reason is the true one.
    const verdict = evaluateSession(
      {
        expiresAt: new Date('2027-01-01T00:00:00Z'),
        revokedAt: new Date('2026-06-07T07:59:59Z'),
        lastSeenAt: now,
      },
      now,
    );
    expect(verdict).toEqual({ valid: false, reason: 'revoked' });
  });

  it('refuses an expired session', () => {
    const verdict = evaluateSession(
      { expiresAt: new Date('2026-06-07T07:59:59Z'), revokedAt: null, lastSeenAt: now },
      now,
    );
    expect(verdict).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a live session', () => {
    const verdict = evaluateSession(
      { expiresAt: new Date('2026-06-07T20:00:00Z'), revokedAt: null, lastSeenAt: now },
      now,
    );
    expect(verdict).toEqual({ valid: true, shouldRenew: false });
  });

  it('renews at most once per renewal window', () => {
    const session = {
      expiresAt: new Date('2026-06-07T20:00:00Z'),
      revokedAt: null,
      lastSeenAt: new Date('2026-06-07T07:30:00Z'),
    };
    expect(shouldRenew(session, now, DEFAULT_SESSION_POLICY)).toBe(false);
    expect(shouldRenew(session, new Date('2026-06-07T08:31:00Z'), DEFAULT_SESSION_POLICY)).toBe(
      true,
    );
  });

  it('extends expiry by the configured lifetime', () => {
    expect(nextExpiry(now, { ttlSeconds: 3600, renewWindowSeconds: 60 }).toISOString()).toBe(
      '2026-06-07T09:00:00.000Z',
    );
  });
});

describe('audit redaction', () => {
  it('never lets a password hash or a session token reach the trail', () => {
    const redacted = redactForAudit({
      id: 'user-1',
      email: 'djaoudi@soficlef.local',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc',
      nested: { tokenHash: 'deadbeef', keep: 'visible' },
    }) as Record<string, unknown>;

    expect(redacted.passwordHash).toBe('[redacted]');
    expect((redacted.nested as Record<string, unknown>).tokenHash).toBe('[redacted]');
    expect((redacted.nested as Record<string, unknown>).keep).toBe('visible');
    expect(redacted.email).toBe('djaoudi@soficlef.local');
  });

  it('redacts inside arrays too', () => {
    const redacted = redactForAudit([{ password: 'hunter2' }]) as Record<string, unknown>[];
    expect(redacted[0].password).toBe('[redacted]');
  });

  it('serialises dates so the snapshot is valid JSONB', () => {
    expect(redactForAudit({ at: new Date('2026-06-07T08:00:00Z') })).toEqual({
      at: '2026-06-07T08:00:00.000Z',
    });
  });
});

describe('password policy', () => {
  it('reports every violation at once rather than one at a time', () => {
    expect(checkPassword('short', DEFAULT_PASSWORD_POLICY).sort()).toEqual(
      ['missing-digit', 'missing-uppercase', 'too-short'].sort(),
    );
  });

  it('accepts a password meeting the policy', () => {
    expect(checkPassword('Soficlef-Dev-2026', DEFAULT_PASSWORD_POLICY)).toEqual([]);
  });

  it('applies a stricter configured policy without a code change', () => {
    expect(
      checkPassword('Soficlef-Dev-2026', { ...DEFAULT_PASSWORD_POLICY, requireSymbol: true }),
    ).toEqual([]);
    expect(
      checkPassword('SoficlefDev2026', { ...DEFAULT_PASSWORD_POLICY, requireSymbol: true }),
    ).toEqual(['missing-symbol']);
  });
});
