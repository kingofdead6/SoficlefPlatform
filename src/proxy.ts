import createIntlProxy from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';

/**
 * Locale negotiation, plus the request path forwarded as a header.
 *
 * Authentication is deliberately *not* done here: proxy code is meant to be deployable to
 * a CDN and must not depend on server-side modules, so the session — a database row —
 * stays where the data is (ADR-036). What the proxy can do cheaply is tell the layout
 * which path is being served: a layout cannot read the pathname, and knowing it lets the
 * authorization check run *before* the shell starts streaming, which is what makes a
 * refused route answer 404 rather than 200 with a 404 page inside it.
 */
export const PATHNAME_HEADER = 'x-soficlef-pathname';

const intlProxy = createIntlProxy(routing);

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);

  return intlProxy(
    new Proxy(request, {
      get(target, property, receiver) {
        if (property === 'headers') return headers;
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as NextRequest,
  );
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
