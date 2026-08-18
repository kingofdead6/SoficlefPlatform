import { serverEnv } from './env';

/**
 * Whether the design-system pages are reachable.
 *
 * They are part of the toolkit, not the product: on in development, off in production
 * unless `ENABLE_DEV_PAGES=true` is set deliberately (a staging review, or an end-to-end
 * run that screenshots them).
 */
export function devPagesEnabled(): boolean {
  const env = serverEnv();
  return env.NODE_ENV !== 'production' || env.ENABLE_DEV_PAGES;
}
