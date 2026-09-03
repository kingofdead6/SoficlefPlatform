import { API_URL } from '../../api.js';

const BASE_URL = API_URL;

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
