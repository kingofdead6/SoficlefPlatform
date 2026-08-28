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
  | 'hr'
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
  'hr',
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
   * ── Ressources humaines (/app/hr) ────────────────────────────────────────
   *
   * HR's own surface. Most entries need `assignment:create` — the act that defines the
   * role — rather than a read, so an administrator who can *see* assignments is still not
   * offered the screens that make them.
   *
   * Every entry is gated on `assignment:create` — the act that defines the role — rather
   * than on reading whatever the screen displays. Gating on the read looked tidier and was
   * wrong: a manager reads assignments, positions and surveys for their own team, so it
   * would have handed them the HR directory. The rule is "who does this job", not "who may
   * see this data".
   */
  {
    id: 'hrDashboard',
    href: '/app/hr',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrUnassigned',
    href: '/app/hr/employees/unassigned',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrEmployees',
    href: '/app/hr/employees',
    group: 'hr',
    /*
     * `assignment:create`, not `read`. A manager legitimately *reads* assignments for
     * their own team, so gating on the read handed them the whole personnel directory —
     * caught by a test asserting no manager sees any HR entry.
     */
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrOrganigram',
    href: '/app/hr/organigram',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrPositions',
    href: '/app/hr/positions',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrTemplates',
    href: '/app/hr/templates',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrDocuments',
    href: '/app/hr/documents',
    group: 'hr',
    requires: { resource: 'document', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrTraining',
    href: '/app/hr/training',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrSurveys',
    href: '/app/hr/surveys',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrAnalytics',
    href: '/app/hr/analytics',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrAlerts',
    href: '/app/hr/alerts',
    group: 'hr',
    requires: { resource: 'assignment', action: 'create' },
    deliveredIn: 15,
  },
  {
    id: 'hrAiKnowledge',
    href: '/app/hr/ai-knowledge',
    group: 'hr',
    requires: { resource: 'document', action: 'create' },
    deliveredIn: 15,
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

/**
 * The nav entry that governs a route, following it up to its closest ancestor.
 *
 * `navItemByHref` is an exact match, which is right for highlighting the sidebar and wrong
 * for authorization: a detail route like `/app/hr/employees/<uuid>` has no entry of its
 * own, so an exact lookup resolves to nothing and the layout — correctly refusing anything
 * it cannot resolve — answers 404 for a page the person may open.
 *
 * Ancestors are matched on whole segments. `/app/hr/employees-archive` must not inherit
 * the permission of `/app/hr/employees`, and a prefix test on the raw string would let it.
 *
 * The longest match wins, so `/app/hr/employees/<id>/assign` is governed by the employees
 * entry rather than by `/app/hr` — the narrower gate, never the broader one.
 */
export function navItemGoverning(href: string): NavItem | undefined {
  const exact = navItemByHref(href);
  if (exact) return exact;

  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (item.href === '/') continue;
    if (!href.startsWith(`${item.href}/`)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}
