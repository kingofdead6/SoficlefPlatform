import createIntlProxy from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

/**
 * Locale negotiation. `middleware.ts` was renamed to `proxy.ts` in Next.js 16; the export
 * is named `proxy` accordingly.
 *
 * It runs before rendering and adds the locale prefix. Authentication is *not* done here:
 * proxy code is meant to be deployable to a CDN and must not rely on shared server
 * modules, so the session check stays where the data is — in the layout and in every
 * route handler, through `can()` (ADR-020).
 */
export const proxy = createIntlProxy(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
