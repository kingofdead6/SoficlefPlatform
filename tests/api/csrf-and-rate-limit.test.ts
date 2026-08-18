import { describe, expect, it } from 'vitest';

import { ApiClient, BASE_URL, DEMO_PASSWORD, USERS } from './setup/client';

/**
 * CSRF and rate limiting, over the wire (CDC v0.1 §15).
 *
 * Both are cheap to claim and easy to get wrong, so they are asserted the way an
 * attacker would test them: with a valid session, sending the request a hostile page
 * would send.
 */

async function signedIn(email: string): Promise<ApiClient> {
  const client = new ApiClient();
  expect((await client.login(email, DEMO_PASSWORD)).status).toBe(200);
  return client;
}

describe('CSRF', () => {
  it('refuses a mutation carrying no token, even with a valid session', async () => {
    const client = await signedIn(USERS.bizAdmin);
    const units = (await (await client.request('/api/v1/organization-units')).json()).data;

    const response = await client.request(`/api/v1/organization-units/${units[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: 'Sans jeton CSRF' }),
      csrf: false,
    });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('csrf');
  });

  it('refuses a mutation whose token does not match the cookie', async () => {
    const client = await signedIn(USERS.bizAdmin);
    const units = (await (await client.request('/api/v1/organization-units')).json()).data;

    const response = await client.request(`/api/v1/organization-units/${units[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: 'Jeton falsifié' }),
      csrf: false,
      headers: { 'x-csrf-token': 'forged-token', origin: BASE_URL },
    });

    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe('token-mismatch');
  });

  it('refuses a mutation posted from another origin', async () => {
    const client = await signedIn(USERS.bizAdmin);
    const units = (await (await client.request('/api/v1/organization-units')).json()).data;

    const response = await client.request(`/api/v1/organization-units/${units[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: 'Depuis un site tiers' }),
      csrf: false,
      headers: {
        'x-csrf-token': client.cookie('soficlef_csrf') ?? '',
        origin: 'https://evil.example',
      },
    });

    expect(response.status).toBe(403);
    expect((await response.json()).reason).toBe('bad-origin');
  });

  it('lets a well-formed mutation through', async () => {
    const client = await signedIn(USERS.bizAdmin);
    const units = (await (await client.request('/api/v1/organization-units')).json()).data;
    const target = units[0];

    const response = await client.request(`/api/v1/organization-units/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: target.nameFr }),
    });

    expect(response.status).toBe(200);
  });
});

describe('login rate limiting', () => {
  it('locks out a password spray against one account, then reports when to retry', async () => {
    const client = new ApiClient();
    const email = 'cible.brute@soficlef.local';

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await client.login(email, `wrong-password-${attempt}`);
      statuses.push(response.status);
      if (response.status === 429) {
        expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
        break;
      }
    }

    expect(statuses).toContain(429);
    // The limit is 5 attempts per window, so the block must arrive by the sixth.
    expect(statuses.indexOf(429)).toBeLessThanOrEqual(5);
  });

  it('does not lock out an account that signs in correctly', async () => {
    const client = await signedIn(USERS.viewer);
    expect((await client.request('/api/v1/auth/me')).status).toBe(200);
  });
});

describe('security headers', () => {
  it('sets the headers configured for every response', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/auth/me`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets the session cookie httpOnly with SameSite', async () => {
    const client = new ApiClient();
    const response = await client.login(USERS.hr, DEMO_PASSWORD);
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith('soficlef_session='));

    expect(session).toBeDefined();
    expect(session!.toLowerCase()).toContain('httponly');
    expect(session!.toLowerCase()).toContain('samesite=lax');
  });
});
