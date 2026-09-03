/**
 * Client-side mirror of server/src/domain/navigation/navigation.js — the nav tree as
 * data, each entry declaring the permission it needs. Filtered here for the sidebar;
 * the Express API is the real boundary for every route.
 */
export const NAV_ITEMS = [
  { id: 'meDashboard', href: '/app/me', group: 'me', labelKey: 'nav.items.meDashboard', end: true, requires: { resource: 'dashboard', action: 'read' } },
  { id: 'meJourney', href: '/app/me/journey', group: 'me', labelKey: 'nav.items.meJourney', requires: { resource: 'onboarding_task', action: 'read' } },
  { id: 'meOrganigram', href: '/app/me/organigram', group: 'me', labelKey: 'nav.items.meOrganigram', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'mePosition', href: '/app/me/position', group: 'me', labelKey: 'nav.items.mePosition', requires: { resource: 'job_description', action: 'read' } },
  { id: 'meTeam', href: '/app/me/team', group: 'me', labelKey: 'nav.items.meTeam', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'meDocuments', href: '/app/me/documents', group: 'me', labelKey: 'nav.items.meDocuments', requires: { resource: 'document', action: 'read' } },
  { id: 'meFiles', href: '/app/me/files', group: 'me', labelKey: 'nav.items.meFiles', requires: { resource: 'document', action: 'read' } },
  { id: 'meTraining', href: '/app/me/training', group: 'me', labelKey: 'nav.items.meTraining', end: true, requires: { resource: 'training', action: 'read' } },
  { id: 'meCertificates', href: '/app/me/training/certificates', group: 'me', labelKey: 'nav.items.meCertificates', requires: { resource: 'training', action: 'read' } },
  { id: 'meSurveys', href: '/app/me/surveys', group: 'me', labelKey: 'nav.items.meSurveys', requires: { resource: 'survey', action: 'read' } },
  { id: 'meQuests', href: '/app/me/quests', group: 'me', labelKey: 'nav.items.meQuests', requires: { resource: 'quest', action: 'read' } },
  { id: 'meAssistant', href: '/app/me/assistant', group: 'me', labelKey: 'nav.items.meAssistant', requires: { resource: 'organization_unit', action: 'read' } },

  { id: 'dashboard', href: '/dashboard', group: 'steering', labelKey: 'nav.items.dashboard', requires: { resource: 'dashboard', action: 'read' } },

  { id: 'welcome', href: '/welcome', group: 'onboarding', labelKey: 'nav.items.welcome', requires: { resource: 'onboarding_instance', action: 'read' } },
  { id: 'company', href: '/company', group: 'onboarding', labelKey: 'nav.items.company', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'strategy', href: '/strategy', group: 'onboarding', labelKey: 'nav.items.strategy', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'jobDescription', href: '/job-description', group: 'onboarding', labelKey: 'nav.items.jobDescription', requires: { resource: 'job_description', action: 'read' } },

  { id: 'organization', href: '/organization', group: 'direction', labelKey: 'nav.items.organization', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'management', href: '/management', group: 'direction', labelKey: 'nav.items.management', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'recruitment', href: '/recruitment', group: 'direction', labelKey: 'nav.items.recruitment', requires: { resource: 'job', action: 'read' } },
  { id: 'kaizen', href: '/kaizen', group: 'direction', labelKey: 'nav.items.kaizen', requires: { resource: 'kaizen_action', action: 'read' } },

  { id: 'qms', href: '/qms', group: 'references', labelKey: 'nav.items.qms', requires: { resource: 'document', action: 'read' } },
  { id: 'hse', href: '/hse', group: 'references', labelKey: 'nav.items.hse', requires: { resource: 'document', action: 'read' } },
  { id: 'contacts', href: '/contacts', group: 'references', labelKey: 'nav.items.contacts', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'documents', href: '/documents', group: 'references', labelKey: 'nav.items.documents', requires: { resource: 'document', action: 'read' } },

  { id: 'onboardingChecklist', href: '/onboarding', group: 'tools', labelKey: 'nav.items.onboardingChecklist', requires: { resource: 'onboarding_task', action: 'read' } },
  { id: 'competencies', href: '/competencies', group: 'tools', labelKey: 'nav.items.competencies', requires: { resource: 'competency', action: 'read' } },
  { id: 'training', href: '/training', group: 'tools', labelKey: 'nav.items.training', requires: { resource: 'training', action: 'read' } },
  { id: 'surveys', href: '/surveys', group: 'tools', labelKey: 'nav.items.surveys', requires: { resource: 'survey', action: 'read' } },
  { id: 'remarks', href: '/remarks', group: 'tools', labelKey: 'nav.items.remarks', requires: { resource: 'remark', action: 'read' } },

  { id: 'managerDashboard', href: '/app/manager', group: 'manager', labelKey: 'nav.items.managerDashboard', end: true, requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerRecruits', href: '/app/manager/recruits', group: 'manager', labelKey: 'nav.items.managerRecruits', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerEvaluations', href: '/app/manager/evaluations', group: 'manager', labelKey: 'nav.items.managerEvaluations', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerOrganigram', href: '/app/manager/organigram', group: 'manager', labelKey: 'nav.items.managerOrganigram', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerTeam', href: '/app/manager/team', group: 'manager', labelKey: 'nav.items.managerTeam', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerReports', href: '/app/manager/reports', group: 'manager', labelKey: 'nav.items.managerReports', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerAssistant', href: '/app/manager/assistant', group: 'manager', labelKey: 'nav.items.managerAssistant', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerCalendar', href: '/app/manager/calendar', group: 'manager', labelKey: 'nav.items.managerCalendar', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerDocuments', href: '/app/manager/documents', group: 'manager', labelKey: 'nav.items.managerDocuments', requires: { resource: 'document', action: 'read' } },
  { id: 'managerArchive', href: '/app/manager/archive', group: 'manager', labelKey: 'nav.items.managerArchive', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerJobDescriptions', href: '/app/manager/job-descriptions', group: 'manager', labelKey: 'nav.items.managerJobDescriptions', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerQuests', href: '/app/manager/quests', group: 'manager', labelKey: 'nav.items.managerQuests', requires: { resource: 'quest', action: 'create' } },
  { id: 'managerSettings', href: '/app/manager/settings', group: 'manager', labelKey: 'nav.items.managerSettings', requires: { resource: 'onboarding_task', action: 'validate' } },

  { id: 'hrDashboard', href: '/app/hr', group: 'hr', labelKey: 'nav.items.hrDashboard', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrUnassigned', href: '/app/hr/employees/unassigned', group: 'hr', labelKey: 'nav.items.hrUnassigned', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrEmployees', href: '/app/hr/employees', group: 'hr', labelKey: 'nav.items.hrEmployees', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrRequestAccount', href: '/app/hr/employees/request', group: 'hr', labelKey: 'nav.items.hrRequestAccount', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrOrganigram', href: '/app/hr/organigram', group: 'hr', labelKey: 'nav.items.hrOrganigram', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrPositions', href: '/app/hr/positions', group: 'hr', labelKey: 'nav.items.hrPositions', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrProbation', href: '/app/hr/probation', group: 'hr', labelKey: 'nav.items.hrProbation', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrTemplates', href: '/app/hr/templates', group: 'hr', labelKey: 'nav.items.hrTemplates', requires: { resource: 'assignment', action: 'create' } },
  /* Kept on document:create, as the server nav has it: this page is the document library. */
  { id: 'hrDocuments', href: '/app/hr/documents', group: 'hr', labelKey: 'nav.items.hrDocuments', requires: { resource: 'document', action: 'create' } },
  /*
   * The remaining HR entries stay gated on `assignment:create` — the permission that defines
   * an HR account — even though their pages' APIs need training:read / survey:read /
   * dashboard:read, which an EMPLOYEE also holds. Gating the *sidebar* on those would put an
   * "Ressources humaines" group in every employee's nav. The routes in App.jsx carry the
   * narrower, honest per-page gate; this list only decides what the sidebar offers.
   */
  { id: 'hrTraining', href: '/app/hr/training', group: 'hr', labelKey: 'nav.items.hrTraining', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveys', href: '/app/hr/surveys', group: 'hr', labelKey: 'nav.items.hrSurveys', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveyResults', href: '/app/hr/surveys/results', group: 'hr', labelKey: 'nav.items.hrSurveyResults', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAnalytics', href: '/app/hr/analytics', group: 'hr', labelKey: 'nav.items.hrAnalytics', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrReports', href: '/app/hr/analytics/reports', group: 'hr', labelKey: 'nav.items.hrReports', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAlerts', href: '/app/hr/alerts', group: 'hr', labelKey: 'nav.items.hrAlerts', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAiKnowledge', href: '/app/hr/ai-knowledge', group: 'hr', labelKey: 'nav.items.hrAiKnowledge', requires: { resource: 'assignment', action: 'create' } },

  { id: 'adminConsole', href: '/admin', group: 'administration', labelKey: 'nav.items.adminConsole', end: true, requires: { resource: 'user', action: 'read' } },
  { id: 'adminUsers', href: '/admin/users', group: 'administration', labelKey: 'nav.items.adminUsers', end: true, requires: { resource: 'user', action: 'create' } },
  { id: 'adminProvisioning', href: '/admin/users/provisioning', group: 'administration', labelKey: 'nav.items.adminProvisioning', requires: { resource: 'user', action: 'create' } },
  { id: 'adminRoles', href: '/admin/roles', group: 'administration', labelKey: 'nav.items.adminRoles', requires: { resource: 'role', action: 'read' } },
  { id: 'adminOrganization', href: '/admin/organization', group: 'administration', labelKey: 'nav.items.adminOrganization', requires: { resource: 'organization_unit', action: 'create' } },
  { id: 'adminIntegrations', href: '/admin/integrations', group: 'administration', labelKey: 'nav.items.adminIntegrations', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAi', href: '/admin/ai', group: 'administration', labelKey: 'nav.items.adminAi', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAudit', href: '/admin/audit', group: 'administration', labelKey: 'nav.items.adminAudit', requires: { resource: 'audit_log', action: 'read' } },
  { id: 'adminSecurity', href: '/admin/security', group: 'administration', labelKey: 'nav.items.adminSecurity', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminBackups', href: '/admin/backups', group: 'administration', labelKey: 'nav.items.adminBackups', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminGdpr', href: '/admin/gdpr', group: 'administration', labelKey: 'nav.items.adminGdpr', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminSettings', href: '/admin/settings', group: 'administration', labelKey: 'nav.items.adminSettings', requires: { resource: 'setting', action: 'update' } },
];

export const NAV_GROUP_LABEL_KEYS = {
  me: 'nav.groups.me',
  manager: 'nav.groups.manager',
  hr: 'nav.groups.hr',
  steering: 'nav.groups.steering',
  onboarding: 'nav.groups.onboarding',
  direction: 'nav.groups.direction',
  references: 'nav.groups.references',
  tools: 'nav.groups.tools',
  administration: 'nav.groups.administration',
};
