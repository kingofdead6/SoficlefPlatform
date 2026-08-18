'use server';

import { cookies, headers } from 'next/headers';

import { login } from '@/application/auth/login';
import { SESSION_COOKIE, sessionCookieOptions } from '@/infrastructure/auth/session-token';
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from '@/infrastructure/security/csrf';

/**
 * Sign-in as a server action.
 *
 * The action is a server boundary like any other, so the payload is re-validated inside
 * `login()` even though the form validates too (ADR-014). The reason returned is
 * deliberately coarse: the caller learns "invalid credentials", never whether the account
 * exists.
 */
export type SignInState = {
  status: 'idle' | 'error';
  reason?: 'invalid-credentials' | 'rate-limited' | 'unexpected';
};

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');

  const result = await login(
    { email: formData.get('email'), password: formData.get('password') },
    {
      ip: forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip'),
      userAgent: headerList.get('user-agent'),
    },
  );

  if (!result.ok) {
    if (result.reason === 'rate-limited') return { status: 'error', reason: 'rate-limited' };
    if (result.reason === 'account-disabled')
      return { status: 'error', reason: 'invalid-credentials' };
    return { status: 'error', reason: 'invalid-credentials' };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  store.set(CSRF_COOKIE, createCsrfToken(), csrfCookieOptions());

  return { status: 'idle' };
}
