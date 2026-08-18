import { beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, DEMO_PASSWORD, USERS } from './setup/client';

/**
 * Authorization over the wire.
 *
 * The point of this suite is the words "by direct API call" in the Part 3 acceptance
 * criteria: hiding a link is not a security boundary, so every claim here is made by a
 * client that has a valid session and simply asks for something it should not get.
 */

async function signIn(email: string): Promise<ApiClient> {
  const client = new ApiClient();
  const response = await client.login(email, DEMO_PASSWORD);
  expect(response.status, `login failed for ${email}`).toBe(200);
  return client;
}

interface Unit {
  id: string;
  code: string;
}

describe('anonymous callers', () => {
  it('cannot read the directory of structures', async () => {
    const anonymous = new ApiClient();
    const response = await anonymous.request('/api/v1/organization-units');
    expect(response.status).toBe(401);
  });

  it('cannot read their own profile', async () => {
    const response = await new ApiClient().request('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('cannot mutate', async () => {
    const response = await new ApiClient().request(
      '/api/v1/organization-units/00000000-0000-4000-8000-000000000000',
      { method: 'PATCH', body: JSON.stringify({ nameFr: 'Piraté' }) },
    );
    expect(response.status).toBe(401);
  });
});

describe('MANAGER scope, enforced server-side', () => {
  let manager: ApiClient;
  let hr: ApiClient;
  let visibleToManager: Unit[];
  let allUnits: Unit[];

  beforeAll(async () => {
    manager = await signIn(USERS.managerFabrication);
    hr = await signIn(USERS.hr);
    visibleToManager = (await (await manager.request('/api/v1/organization-units')).json()).data;
    allUnits = (await (await hr.request('/api/v1/organization-units')).json()).data;
  });

  it('lists only the manager’s structure and what hangs beneath it', () => {
    const codes = visibleToManager.map((unit) => unit.code).sort();
    expect(codes).toEqual(['DPR-FABRICATION', 'DPR-UNITE-BROUETTE', 'DPR-UNITE-COFFRE']);
  });

  it('does not simply return the full set for the UI to filter', () => {
    // The data layer narrows the query (ADR-021): the response is genuinely smaller.
    expect(visibleToManager.length).toBeLessThan(allUnits.length);
  });

  it('cannot read a sibling structure by its id', async () => {
    const maintenance = allUnits.find((unit) => unit.code === 'DPR-MAINTENANCE');
    expect(maintenance).toBeDefined();

    const response = await manager.request(`/api/v1/organization-units/${maintenance!.id}`);
    // 404, not 403: an out-of-scope record must not be distinguishable from a missing one.
    expect(response.status).toBe(404);
  });

  it('cannot update a sibling structure by its id', async () => {
    const maintenance = allUnits.find((unit) => unit.code === 'DPR-MAINTENANCE');
    const response = await manager.request(`/api/v1/organization-units/${maintenance!.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: 'Renommée par un manager hors périmètre' }),
    });
    expect(response.status).toBe(403);

    const check = await hr.request(`/api/v1/organization-units/${maintenance!.id}`);
    const { data } = await check.json();
    expect(data.nameFr).not.toContain('hors périmètre');
  });

  it('reads a unit inside its own subtree', async () => {
    const coffre = visibleToManager.find((unit) => unit.code === 'DPR-UNITE-COFFRE');
    const response = await manager.request(`/api/v1/organization-units/${coffre!.id}`);
    expect(response.status).toBe(200);
  });
});

describe('EMPLOYEE has no organizational breadth', () => {
  it('receives an empty list rather than the whole reference frame', async () => {
    const employee = await signIn(USERS.employee);
    const response = await employee.request('/api/v1/organization-units');

    // 200 with nothing, not 500 and not the full set: being authenticated grants no
    // breadth of its own (CDC v0.1 §3).
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });

  it('cannot read a structure by its id', async () => {
    const hr = await signIn(USERS.hr);
    const units = (await (await hr.request('/api/v1/organization-units')).json()).data as Unit[];
    const employee = await signIn(USERS.employee);

    const response = await employee.request(`/api/v1/organization-units/${units[0].id}`);
    expect(response.status).toBe(404);
  });
});

describe('the pilot user holds two profiles at once', () => {
  it('sees the whole Direction de Production as its MANAGER, and no more', async () => {
    const pilot = await signIn(USERS.pilotUser);
    const me = await (await pilot.request('/api/v1/auth/me')).json();
    expect(me.assignments.map((a: { role: string }) => a.role).sort()).toEqual([
      'EMPLOYEE',
      'MANAGER',
    ]);

    const units = (await (await pilot.request('/api/v1/organization-units')).json()).data as Unit[];
    expect(units.map((unit) => unit.code)).toContain('DPR-MAINTENANCE');
  });
});

describe('VIEWER is refused every mutation', () => {
  it('gets 403 on a structure update', async () => {
    const viewer = await signIn(USERS.viewer);
    const units = (await (await viewer.request('/api/v1/organization-units')).json())
      .data as Unit[];
    expect(units.length).toBeGreaterThan(0);

    const response = await viewer.request(`/api/v1/organization-units/${units[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nameFr: 'Modifié par un lecteur' }),
    });
    expect(response.status).toBe(403);
  });

  it('gets 403 when granting itself a role', async () => {
    const viewer = await signIn(USERS.viewer);
    const me = await (await viewer.request('/api/v1/auth/me')).json();

    const response = await viewer.request(`/api/v1/users/${me.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode: 'TECH_ADMIN' }),
    });
    expect(response.status).toBe(403);

    const after = await (await viewer.request('/api/v1/auth/me')).json();
    expect(after.assignments.map((a: { role: string }) => a.role)).toEqual(['VIEWER']);
  });
});

describe('privilege escalation', () => {
  it('refuses a technical administrator granting a role to themselves', async () => {
    const admin = await signIn(USERS.techAdmin);
    const me = await (await admin.request('/api/v1/auth/me')).json();

    const response = await admin.request(`/api/v1/users/${me.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode: 'HEAD_CE' }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'self_assignment_refused' });

    const after = await (await admin.request('/api/v1/auth/me')).json();
    expect(after.assignments.map((a: { role: string }) => a.role)).toEqual(['TECH_ADMIN']);
  });

  it('lets a technical administrator grant a role to someone else', async () => {
    const admin = await signIn(USERS.techAdmin);
    const viewer = await signIn(USERS.viewer);
    const target = await (await viewer.request('/api/v1/auth/me')).json();

    // Re-granting the role the target already holds: the happy path is exercised without
    // this suite widening anyone's rights for the suites that follow.
    const response = await admin.request(`/api/v1/users/${target.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleCode: 'VIEWER' }),
    });
    expect(response.status).toBe(201);

    const after = await (await viewer.request('/api/v1/auth/me')).json();
    expect(after.assignments.map((a: { role: string }) => a.role)).toEqual(['VIEWER']);
  });
});
