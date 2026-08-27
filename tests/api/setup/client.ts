/**
 * A tiny HTTP client that keeps cookies, so a test can log in and then act as that user
 * exactly as a browser would — including sending the CSRF header the double-submit
 * check requires.
 */

export const BASE_URL = `http://127.0.0.1:${Number(process.env.API_TEST_PORT ?? 3011)}`;

export class ApiClient {
  private readonly cookies = new Map<string, string>();

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  clearCookie(name: string): void {
    this.cookies.delete(name);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  private header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private absorb(response: Response): void {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request(path: string, init: RequestInit & { csrf?: boolean } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookieHeader = this.header();
    if (cookieHeader) headers.set('cookie', cookieHeader);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

    const method = (init.method ?? 'GET').toUpperCase();
    const needsCsrf = init.csrf !== false && !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (needsCsrf) {
      const token = this.cookies.get('soficlef_csrf');
      if (token) headers.set('x-csrf-token', token);
      headers.set('origin', BASE_URL);
    }

    const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: 'manual' });
    this.absorb(response);
    return response;
  }

  async login(email: string, password: string): Promise<Response> {
    return this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      csrf: false,
    });
  }
}

export const DEMO_PASSWORD = 'Soficlef-Test-2026!';

/**
 * The seeded cast, by intent rather than by address.
 *
 * Several keys now point at the same account: collapsing seven roles into four means the
 * former technical administrator, business administrator, Head C&E and reader are one
 * `ADMIN`. The keys are kept so the suites still read as "what this role may do" — and so
 * a future split does not have to touch every call site again.
 */
export const USERS = {
  admin: 'admin@soficlef.local',
  hr: 'rh@soficlef.local',
  managerFabrication: 'manager@soficlef.local',
  employee: 'nouveau.1@soficlef.local',
  /** A recruit far enough in that the J+30 survey and mid-journey tasks exist. */
  employeeMidJourney: 'nouveau.3@soficlef.local',
  /** Created but never given a post: reaches `/pending` and nothing else. */
  unassigned: 'attente@soficlef.local',

  // Aliases from the seven-role model, so existing assertions keep their meaning.
  techAdmin: 'admin@soficlef.local',
  headCe: 'admin@soficlef.local',
  bizAdmin: 'admin@soficlef.local',
  viewer: 'admin@soficlef.local',
  pilotUser: 'nouveau.1@soficlef.local',
} as const;
