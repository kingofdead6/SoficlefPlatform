const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * A minimal, unauthenticated fetch for the anonymous marketing pages — deliberately not
 * the shared `api` client, which always sends credentials for the authenticated app. The
 * public pages must work with no session at all.
 */
async function publicGet(path) {
  const response = await fetch(`${BASE_URL}/public${path}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Request failed with status ${response.status}`);
  return data;
}

export const publicApi = {
  company: () => publicGet('/company'),
  values: () => publicGet('/values'),
  strategy: () => publicGet('/strategy'),
  positions: () => publicGet('/positions'),
  /** Company structure for the public org chart — structural columns only. */
  organization: () => publicGet('/organization'),
};
