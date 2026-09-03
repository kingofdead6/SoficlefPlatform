/**
 * The navigation tree, as data (ported verbatim from domain/navigation/navigation.ts).
 * Each entry declares the permission it needs; the sidebar is filtered from this list
 * and each route re-checks the same pair via can(). Hidden links are a courtesy — the
 * route is the boundary.
 */

export const NAV_GROUPS = [
  'me',
  'manager',
  'hr',
  'steering',
  'onboarding',
  'direction',
  'references',
  'tools',
  'administration',
];

export const NAV_ITEMS = [
  { id: 'meDashboard', href: '/app/me', group: 'me', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'meJourney', href: '/app/me/journey', group: 'me', requires: { resource: 'onboarding_task', action: 'read' }, badge: 'onboarding-progress' },
  { id: 'meOrganigram', href: '/app/me/organigram', group: 'me', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'mePosition', href: '/app/me/position', group: 'me', requires: { resource: 'job_description', action: 'read' } },
  { id: 'meTeam', href: '/app/me/team', group: 'me', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'meDocuments', href: '/app/me/documents', group: 'me', requires: { resource: 'document', action: 'read' } },
  { id: 'meFiles', href: '/app/me/files', group: 'me', requires: { resource: 'document', action: 'read' } },
  { id: 'meTraining', href: '/app/me/training', group: 'me', requires: { resource: 'training', action: 'read' } },
  { id: 'meCertificates', href: '/app/me/training/certificates', group: 'me', requires: { resource: 'training', action: 'read' } },
  { id: 'meSurveys', href: '/app/me/surveys', group: 'me', requires: { resource: 'survey', action: 'read' } },
  { id: 'meAssistant', href: '/app/me/assistant', group: 'me', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'meQuests', href: '/app/me/quests', group: 'me', requires: { resource: 'quest', action: 'read' } },

  { id: 'dashboard', href: '/dashboard', group: 'steering', requires: { resource: 'dashboard', action: 'read' } },

  { id: 'welcome', href: '/welcome', group: 'onboarding', requires: { resource: 'onboarding_instance', action: 'read' } },
  { id: 'company', href: '/company', group: 'onboarding', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'strategy', href: '/strategy', group: 'onboarding', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'jobDescription', href: '/job-description', group: 'onboarding', requires: { resource: 'job_description', action: 'read' } },

  { id: 'organization', href: '/organization', group: 'direction', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'management', href: '/management', group: 'direction', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'recruitment', href: '/recruitment', group: 'direction', requires: { resource: 'job', action: 'read' } },
  { id: 'kaizen', href: '/kaizen', group: 'direction', requires: { resource: 'kaizen_action', action: 'read' } },

  { id: 'qms', href: '/qms', group: 'references', requires: { resource: 'document', action: 'read' } },
  { id: 'hse', href: '/hse', group: 'references', requires: { resource: 'document', action: 'read' } },
  { id: 'contacts', href: '/contacts', group: 'references', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'documents', href: '/documents', group: 'references', requires: { resource: 'document', action: 'read' } },

  { id: 'onboardingChecklist', href: '/onboarding', group: 'tools', requires: { resource: 'onboarding_task', action: 'read' }, badge: 'onboarding-progress' },
  { id: 'competencies', href: '/competencies', group: 'tools', requires: { resource: 'competency', action: 'read' } },
  { id: 'training', href: '/training', group: 'tools', requires: { resource: 'training', action: 'read' } },
  { id: 'surveys', href: '/surveys', group: 'tools', requires: { resource: 'survey', action: 'read' } },
  { id: 'remarks', href: '/remarks', group: 'tools', requires: { resource: 'remark', action: 'read' } },

  { id: 'managerDashboard', href: '/app/manager', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerRecruits', href: '/app/manager/recruits', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerEvaluations', href: '/app/manager/evaluations', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerOrganigram', href: '/app/manager/organigram', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerTeam', href: '/app/manager/team', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerReports', href: '/app/manager/reports', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerAssistant', href: '/app/manager/assistant', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerJobDescriptions', href: '/app/manager/job-descriptions', group: 'manager', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerQuests', href: '/app/manager/quests', group: 'manager', requires: { resource: 'quest', action: 'create' } },

  { id: 'hrDashboard', href: '/app/hr', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrUnassigned', href: '/app/hr/employees/unassigned', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrEmployees', href: '/app/hr/employees', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrRequestAccount', href: '/app/hr/employees/request', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrOrganigram', href: '/app/hr/organigram', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrPositions', href: '/app/hr/positions', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrTemplates', href: '/app/hr/templates', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrDocuments', href: '/app/hr/documents', group: 'hr', requires: { resource: 'document', action: 'create' } },
  { id: 'hrTraining', href: '/app/hr/training', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveys', href: '/app/hr/surveys', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveyResults', href: '/app/hr/surveys/results', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAnalytics', href: '/app/hr/analytics', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrReports', href: '/app/hr/analytics/reports', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAlerts', href: '/app/hr/alerts', group: 'hr', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAiKnowledge', href: '/app/hr/ai-knowledge', group: 'hr', requires: { resource: 'assignment', action: 'create' } },

  { id: 'adminConsole', href: '/admin', group: 'administration', requires: { resource: 'user', action: 'read' } },
  { id: 'adminUsers', href: '/admin/users', group: 'administration', requires: { resource: 'user', action: 'create' } },
  { id: 'adminRoles', href: '/admin/roles', group: 'administration', requires: { resource: 'role', action: 'read' } },
  { id: 'adminOrganization', href: '/admin/organization', group: 'administration', requires: { resource: 'organization_unit', action: 'create' } },
  { id: 'adminIntegrations', href: '/admin/integrations', group: 'administration', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAi', href: '/admin/ai', group: 'administration', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAudit', href: '/admin/audit', group: 'administration', requires: { resource: 'audit_log', action: 'read' } },
  { id: 'adminSecurity', href: '/admin/security', group: 'administration', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminBackups', href: '/admin/backups', group: 'administration', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminGdpr', href: '/admin/gdpr', group: 'administration', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminSettings', href: '/admin/settings', group: 'administration', requires: { resource: 'setting', action: 'update' } },
];

export function navItemByHref(href) {
  return NAV_ITEMS.find((item) => item.href === href);
}

export function navItemGoverning(href) {
  const exact = navItemByHref(href);
  if (exact) return exact;

  let best;
  for (const item of NAV_ITEMS) {
    if (item.href === '/') continue;
    if (!href.startsWith(`${item.href}/`)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}
