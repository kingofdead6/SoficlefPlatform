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

export type NavGroupId =
  | 'me'
  | 'steering'
  | 'onboarding'
  | 'direction'
  | 'references'
  | 'tools'
  | 'administration';

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

export const NAV_GROUPS: NavGroupId[] = [
  'me',
  'steering',
  'onboarding',
  'direction',
  'references',
  'tools',
  'administration',
];

export const NAV_ITEMS: NavItem[] = [
  /*
   * ── Mon espace (/app/me) ─────────────────────────────────────────────────
   *
   * The new arrival's own surface. Every entry is gated on a permission the person holds
   * over *their own* rows, so a SELF-scoped account sees the whole group and nobody else's
   * data — the scope does the narrowing, in the query, not the route prefix.
   *
   * The prefix is organisational, not a security boundary: `can()` is still what decides.
   */
  {
    id: 'meDashboard',
    href: '/app/me',
    group: 'me',
    requires: { resource: 'dashboard', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meJourney',
    href: '/app/me/journey',
    group: 'me',
    requires: { resource: 'onboarding_task', action: 'read' },
    deliveredIn: 14,
    badge: 'onboarding-progress',
  },
  {
    id: 'meOrganigram',
    href: '/app/me/organigram',
    group: 'me',
    requires: { resource: 'organization_unit', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'mePosition',
    href: '/app/me/position',
    group: 'me',
    requires: { resource: 'job_description', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meTeam',
    href: '/app/me/team',
    group: 'me',
    requires: { resource: 'organization_unit', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meDocuments',
    href: '/app/me/documents',
    group: 'me',
    requires: { resource: 'document', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meFiles',
    href: '/app/me/files',
    group: 'me',
    requires: { resource: 'document', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meTraining',
    href: '/app/me/training',
    group: 'me',
    requires: { resource: 'training', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meSurveys',
    href: '/app/me/surveys',
    group: 'me',
    requires: { resource: 'survey', action: 'read' },
    deliveredIn: 14,
  },
  {
    id: 'meAssistant',
    href: '/app/me/assistant',
    group: 'me',
    requires: { resource: 'organization_unit', action: 'read' },
    deliveredIn: 14,
  },

  // ── Pilotage ───────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    href: '/dashboard',
    group: 'steering',
    requires: { resource: 'dashboard', action: 'read' },
    deliveredIn: 13,
  },

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
    id: 'training',
    href: '/training',
    group: 'tools',
    requires: { resource: 'training', action: 'read' },
    deliveredIn: 15,
  },
  {
    id: 'surveys',
    href: '/surveys',
    group: 'tools',
    requires: { resource: 'survey', action: 'read' },
    deliveredIn: 15,
  },
  {
    id: 'remarks',
    href: '/remarks',
    group: 'tools',
    requires: { resource: 'remark', action: 'read' },
    deliveredIn: 10,
  },

  /*
   * Personnel administration — the HR half of the provisioning chain.
   *
   * Gated on `assignment:create`, not `assignment:read`.
   *
   * The distinction matters: TECH_ADMIN *reads* assignments (it administers the platform
   * and must be able to see who is placed where) but must never make one, because SI
   * creating an account and then placing it would be the whole provisioning chain in one
   * pair of hands. The screen that performs the act is offered only to whoever may
   * perform it.
   */
  {
    id: 'hr',
    href: '/hr',
    group: 'administration',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 13,
  },

  // ── Administration ─────────────────────────────────────────────────────────
  // Gated on `user:read`, which only TECH_ADMIN holds: the administration screens are
  // accounts, roles and the audit trail, not the business reference frame.
  {
    id: 'admin',
    href: '/admin',
    group: 'administration',
    requires: { resource: 'user', action: 'read' },
    deliveredIn: 13,
  },
];

/**
 * The AI assistant is deliberately absent: it is phase 2, and the prototype's
 * browser-side implementation could never have worked outside a sandbox (ADR-003, OQ-25).
 */

export function navItemByHref(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}
