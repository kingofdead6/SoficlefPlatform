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

export const USERS = {
  techAdmin: 'tech.admin@soficlef.local',
  headCe: 'mostafa@soficlef.local',
  bizAdmin: 'chanane@soficlef.local',
  hr: 'drh@soficlef.local',
  managerFabrication: 'oudni@soficlef.local',
  employee: 'boubenia@soficlef.local',
  pilotUser: 'djaoudi@soficlef.local',
  viewer: 'charikhi@soficlef.local',
} as const;
