import type { Action, Resource } from '@/domain/auth/permissions';

/**
 * The navigation tree, as data.
 *
 * Each entry declares the permission it needs, so the menu and the route agree by
 * construction: the sidebar is filtered from this list on the server (ADR-031) and the
 * page itself checks the same pair through `can()` (ADR-020). Hidden links are a
 * courtesy; the route is the boundary.
 *
 * Domain code: no framework imports (ADR-019).
 */

export type NavGroupId = 'onboarding' | 'direction' | 'references' | 'tools';

export interface NavItem {
  /** Key into `messages.nav.items`, and the item's stable id. */
  id: string;
  /** Path after the locale prefix, e.g. "/welcome". */
  href: string;
  group: NavGroupId;
  requires: { resource: Resource; action: Action };
  /** Which Part delivers the content behind this route. */
  deliveredIn: number;
  /** Set when the item carries a counter, e.g. the 30-day checklist. */
  badge?: 'onboarding-progress';
}

export const NAV_GROUPS: NavGroupId[] = ['onboarding', 'direction', 'references', 'tools'];

export const NAV_ITEMS: NavItem[] = [
  // ── Onboarding ─────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    href: '/welcome',
    group: 'onboarding',
    requires: { resource: 'onboarding_instance', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'company',
    href: '/company',
    group: 'onboarding',
    requires: { resource: 'dashboard', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'strategy',
    href: '/strategy',
    group: 'onboarding',
    requires: { resource: 'dashboard', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'jobDescription',
    href: '/job-description',
    group: 'onboarding',
    requires: { resource: 'job_description', action: 'read' },
    deliveredIn: 6,
  },

  // ── Direction ──────────────────────────────────────────────────────────────
  {
    id: 'organization',
    href: '/organization',
    group: 'direction',
    requires: { resource: 'organization_unit', action: 'read' },
    deliveredIn: 7,
  },
  {
    id: 'management',
    href: '/management',
    group: 'direction',
    requires: { resource: 'organization_unit', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'recruitment',
    href: '/recruitment',
    group: 'direction',
    requires: { resource: 'job', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'kaizen',
    href: '/kaizen',
    group: 'direction',
    requires: { resource: 'kaizen_action', action: 'read' },
    deliveredIn: 8,
  },

  // ── Référentiels ───────────────────────────────────────────────────────────
  {
    id: 'qms',
    href: '/qms',
    group: 'references',
    requires: { resource: 'document', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'hse',
    href: '/hse',
    group: 'references',
    requires: { resource: 'document', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'contacts',
    href: '/contacts',
    group: 'references',
    requires: { resource: 'dashboard', action: 'read' },
    deliveredIn: 6,
  },
  {
    id: 'documents',
    href: '/documents',
    group: 'references',
    requires: { resource: 'document', action: 'read' },
    deliveredIn: 12,
  },

  // ── Outils ─────────────────────────────────────────────────────────────────
  {
    id: 'onboardingChecklist',
    href: '/onboarding',
    group: 'tools',
    requires: { resource: 'onboarding_task', action: 'read' },
    deliveredIn: 9,
    badge: 'onboarding-progress',
  },
  {
    id: 'competencies',
    href: '/competencies',
    group: 'tools',
    requires: { resource: 'competency', action: 'read' },
    deliveredIn: 11,
  },
  {
    id: 'remarks',
    href: '/remarks',
    group: 'tools',
    requires: { resource: 'remark', action: 'read' },
    deliveredIn: 10,
  },
];

/**
 * The AI assistant is deliberately absent: it is phase 2, and the prototype's
 * browser-side implementation could never have worked outside a sandbox (ADR-003, OQ-25).
 */

export function navItemByHref(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}
