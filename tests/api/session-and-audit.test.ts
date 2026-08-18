import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/infrastructure/db/generated/client';

import { ApiClient, DEMO_PASSWORD, USERS } from './setup/client';

/**
 * Session revocation and the audit trail, verified against the wire *and* the database:
 * an audited change nobody can see, and a change with no audit row, are both defects
 * (ADR-022).
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

describe('session revocation takes effect on the next request', () => {
  it('signs a user out server-side, not just in their browser', async () => {
    const client = await signedIn(USERS.hr);
    expect((await client.request('/api/v1/auth/me')).status).toBe(200);

    // Keep the cookie the browser would keep: only the server-side row is revoked.
    const sessionCookie = client.cookie('soficlef_session');
    expect(sessionCookie).toBeTruthy();

    expect((await client.request('/api/v1/auth/logout', { method: 'POST' })).status).toBe(200);

    client.setCookie('soficlef_session', sessionCookie!);
    const afterRevocation = await client.request('/api/v1/auth/me');
    expect(afterRevocation.status).toBe(401);
  });

  it('refuses a session revoked out of band, with the cookie still in hand', async () => {
    const client = await signedIn(USERS.viewer);
    const token = client.cookie('soficlef_session')!;

    const user = await prisma.user.findUniqueOrThrow({ where: { email: USERS.viewer } });
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    client.setCookie('soficlef_session', token);
    expect((await client.request('/api/v1/auth/me')).status).toBe(401);
  });

  it('refuses a forged token', async () => {
    const client = new ApiClient();
    client.setCookie('soficlef_session', 'not-a-real-token');
    expect((await client.request('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('the audit trail records who, when, what, before and after', () => {
  it('records a successful login', async () => {
    const before = new Date();
    await signedIn(USERS.headCe);

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'auth.login', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    expect(entry!.actorId).not.toBeNull();
    expect(entry!.actorLabel).toContain(USERS.headCe);
    expect(entry!.entityType).toBe('session');
  });

  it('records a failed login without revealing whether the account exists', async () => {
    const before = new Date();
    const client = new ApiClient();

    const response = await client.login('inconnu@soficlef.local', 'whatever-1234');
    expect(response.status).toBe(401);

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'auth.login_failed', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect(entry!.actorId).toBeNull();
    expect(entry!.actorLabel).toBe('inconnu@soficlef.local');
  });

  it('records a logout', async () => {
    const before = new Date();
    const client = await signedIn(USERS.hr);
    await client.request('/api/v1/auth/logout', { method: 'POST' });

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'auth.logout', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
  });

  it('records a structure update with both snapshots', async () => {
    const admin = await signedIn(USERS.bizAdmin);
    const units = (await (await admin.request('/api/v1/organization-units')).json()).data as {
      id: string;
      code: string;
      nameFr: string;
    }[];
    const target = units.find((unit) => unit.code === 'DPR-MAINTENANCE')!;
    const renamed = `${target.nameFr} · révisé`;

    const before = new Date();
    const response = await admin.request(`/api/v1/organization-units/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: renamed }),
    });
    expect(response.status).toBe(200);

    const entry = await prisma.auditLog.findFirst({
      where: {
        action: 'entity.updated',
        entityType: 'organization_unit',
        entityId: target.id,
        createdAt: { gte: before },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    expect((entry!.before as { nameFr: string }).nameFr).toBe(target.nameFr);
    expect((entry!.after as { nameFr: string }).nameFr).toBe(renamed);
    expect(entry!.actorLabel).toContain(USERS.bizAdmin);

    // Put it back so the suite leaves the data as it found it.
    await admin.request(`/api/v1/organization-units/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: target.nameFr }),
    });
  });

  it('records a refused self-assignment, not merely refusing it', async () => {
    const admin = await signedIn(USERS.techAdmin);
    const me = await (await admin.request('/api/v1/auth/me')).json();

    const before = new Date();
    const response = await admin.request(`/api/v1/users/${me.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode: 'HEAD_CE' }),
    });
    expect(response.status).toBe(403);

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'user.role_assignment_denied', createdAt: { gte: before } },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect((entry!.after as { reason: string }).reason).toBe('self-assignment');
  });

  it('never writes a password hash or a session token into the trail', async () => {
    const rows = await prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } });
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain('$argon2');
    expect(serialised).not.toMatch(/"tokenHash":"[0-9a-f]{16,}"/);
  });
});

async function signedIn(email: string): Promise<ApiClient> {
  const client = new ApiClient();
  const response = await client.login(email, DEMO_PASSWORD);
  expect(response.status, `login failed for ${email}`).toBe(200);
  return client;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Leave no connection behind, or the runner hangs after the last assertion.
  await prisma.$disconnect();
});
