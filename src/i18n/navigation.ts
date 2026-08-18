import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation. Use these in place of `next/link` and `next/navigation` so a
 * link keeps the reader in their language without every call site remembering to add the
 * prefix.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
