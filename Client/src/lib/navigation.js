/**
 * Client-side mirror of server/src/domain/navigation/navigation.js — the nav tree as
 * data, each entry declaring the permission it needs. Filtered here for the sidebar;
 * the Express API is the real boundary for every route.
 */
export const NAV_ITEMS = [
  { id: 'meDashboard', href: '/app/me', group: 'me', labelFr: 'Tableau de bord', end: true, requires: { resource: 'dashboard', action: 'read' } },
  { id: 'meJourney', href: '/app/me/journey', group: 'me', labelFr: 'Mon parcours', requires: { resource: 'onboarding_task', action: 'read' } },
  { id: 'meOrganigram', href: '/app/me/organigram', group: 'me', labelFr: 'Organigramme', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'mePosition', href: '/app/me/position', group: 'me', labelFr: 'Ma fiche de poste', requires: { resource: 'job_description', action: 'read' } },
  { id: 'meTeam', href: '/app/me/team', group: 'me', labelFr: 'Mon équipe', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'meDocuments', href: '/app/me/documents', group: 'me', labelFr: 'Mes documents', requires: { resource: 'document', action: 'read' } },
  { id: 'meFiles', href: '/app/me/files', group: 'me', labelFr: 'Mes justificatifs', requires: { resource: 'document', action: 'read' } },
  { id: 'meTraining', href: '/app/me/training', group: 'me', labelFr: 'Ma formation', end: true, requires: { resource: 'training', action: 'read' } },
  { id: 'meCertificates', href: '/app/me/training/certificates', group: 'me', labelFr: 'Mes attestations', requires: { resource: 'training', action: 'read' } },
  { id: 'meSurveys', href: '/app/me/surveys', group: 'me', labelFr: 'Mes enquêtes', requires: { resource: 'survey', action: 'read' } },
  { id: 'meAssistant', href: '/app/me/assistant', group: 'me', labelFr: 'Assistant', requires: { resource: 'organization_unit', action: 'read' } },

  { id: 'dashboard', href: '/dashboard', group: 'steering', labelFr: 'Pilotage', requires: { resource: 'dashboard', action: 'read' } },

  { id: 'welcome', href: '/welcome', group: 'onboarding', labelFr: "Bienvenue", requires: { resource: 'onboarding_instance', action: 'read' } },
  { id: 'company', href: '/company', group: 'onboarding', labelFr: 'Entreprise', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'strategy', href: '/strategy', group: 'onboarding', labelFr: 'Stratégie', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'jobDescription', href: '/job-description', group: 'onboarding', labelFr: 'Fiches de poste', requires: { resource: 'job_description', action: 'read' } },

  { id: 'organization', href: '/organization', group: 'direction', labelFr: 'Organisation', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'management', href: '/management', group: 'direction', labelFr: 'Direction', requires: { resource: 'organization_unit', action: 'read' } },
  { id: 'recruitment', href: '/recruitment', group: 'direction', labelFr: 'Recrutement', requires: { resource: 'job', action: 'read' } },
  { id: 'kaizen', href: '/kaizen', group: 'direction', labelFr: 'Kaizen', requires: { resource: 'kaizen_action', action: 'read' } },

  { id: 'qms', href: '/qms', group: 'references', labelFr: 'SMQ', requires: { resource: 'document', action: 'read' } },
  { id: 'hse', href: '/hse', group: 'references', labelFr: 'HSE', requires: { resource: 'document', action: 'read' } },
  { id: 'contacts', href: '/contacts', group: 'references', labelFr: 'Contacts', requires: { resource: 'dashboard', action: 'read' } },
  { id: 'documents', href: '/documents', group: 'references', labelFr: 'Documents', requires: { resource: 'document', action: 'read' } },

  { id: 'onboardingChecklist', href: '/onboarding', group: 'tools', labelFr: 'Checklist onboarding', requires: { resource: 'onboarding_task', action: 'read' } },
  { id: 'competencies', href: '/competencies', group: 'tools', labelFr: 'Compétences', requires: { resource: 'competency', action: 'read' } },
  { id: 'training', href: '/training', group: 'tools', labelFr: 'Formation', requires: { resource: 'training', action: 'read' } },
  { id: 'surveys', href: '/surveys', group: 'tools', labelFr: 'Enquêtes', requires: { resource: 'survey', action: 'read' } },
  { id: 'remarks', href: '/remarks', group: 'tools', labelFr: 'Remarques', requires: { resource: 'remark', action: 'read' } },

  { id: 'managerDashboard', href: '/app/manager', group: 'manager', labelFr: 'Tableau de bord', end: true, requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerRecruits', href: '/app/manager/recruits', group: 'manager', labelFr: 'Nouvelles recrues', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerEvaluations', href: '/app/manager/evaluations', group: 'manager', labelFr: 'Évaluations', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerOrganigram', href: '/app/manager/organigram', group: 'manager', labelFr: 'Organigramme', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerTeam', href: '/app/manager/team', group: 'manager', labelFr: 'Mon équipe', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerReports', href: '/app/manager/reports', group: 'manager', labelFr: 'Rapports', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerAssistant', href: '/app/manager/assistant', group: 'manager', labelFr: 'Assistant', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerCalendar', href: '/app/manager/calendar', group: 'manager', labelFr: 'Calendrier', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerDocuments', href: '/app/manager/documents', group: 'manager', labelFr: 'Documents', requires: { resource: 'document', action: 'read' } },
  { id: 'managerArchive', href: '/app/manager/archive', group: 'manager', labelFr: 'Archive', requires: { resource: 'onboarding_task', action: 'validate' } },
  { id: 'managerSettings', href: '/app/manager/settings', group: 'manager', labelFr: 'Paramètres', requires: { resource: 'onboarding_task', action: 'validate' } },

  { id: 'hrDashboard', href: '/app/hr', group: 'hr', labelFr: 'Tableau de bord', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrUnassigned', href: '/app/hr/employees/unassigned', group: 'hr', labelFr: 'Non affectés', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrEmployees', href: '/app/hr/employees', group: 'hr', labelFr: 'Collaborateurs', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrRequestAccount', href: '/app/hr/employees/request', group: 'hr', labelFr: 'Demandes de compte', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrOrganigram', href: '/app/hr/organigram', group: 'hr', labelFr: 'Organigramme', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrPositions', href: '/app/hr/positions', group: 'hr', labelFr: 'Postes', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrProbation', href: '/app/hr/probation', group: 'hr', labelFr: "Périodes d'essai", requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrTemplates', href: '/app/hr/templates', group: 'hr', labelFr: "Modèles d'intégration", requires: { resource: 'assignment', action: 'create' } },
  /* Kept on document:create, as the server nav has it: this page is the document library. */
  { id: 'hrDocuments', href: '/app/hr/documents', group: 'hr', labelFr: 'Documents', requires: { resource: 'document', action: 'create' } },
  /*
   * The remaining HR entries stay gated on `assignment:create` — the permission that defines
   * an HR account — even though their pages' APIs need training:read / survey:read /
   * dashboard:read, which an EMPLOYEE also holds. Gating the *sidebar* on those would put an
   * "Ressources humaines" group in every employee's nav. The routes in App.jsx carry the
   * narrower, honest per-page gate; this list only decides what the sidebar offers.
   */
  { id: 'hrTraining', href: '/app/hr/training', group: 'hr', labelFr: 'Formation', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveys', href: '/app/hr/surveys', group: 'hr', labelFr: 'Enquêtes', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrSurveyResults', href: '/app/hr/surveys/results', group: 'hr', labelFr: 'Résultats des enquêtes', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAnalytics', href: '/app/hr/analytics', group: 'hr', labelFr: 'Analytique', end: true, requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrReports', href: '/app/hr/analytics/reports', group: 'hr', labelFr: 'Rapports', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAlerts', href: '/app/hr/alerts', group: 'hr', labelFr: 'Alertes', requires: { resource: 'assignment', action: 'create' } },
  { id: 'hrAiKnowledge', href: '/app/hr/ai-knowledge', group: 'hr', labelFr: 'Base de connaissances', requires: { resource: 'assignment', action: 'create' } },

  { id: 'adminConsole', href: '/admin', group: 'administration', labelFr: 'Console', end: true, requires: { resource: 'user', action: 'read' } },
  { id: 'adminUsers', href: '/admin/users', group: 'administration', labelFr: 'Comptes', end: true, requires: { resource: 'user', action: 'create' } },
  { id: 'adminProvisioning', href: '/admin/users/provisioning', group: 'administration', labelFr: 'File de provisionnement', requires: { resource: 'user', action: 'create' } },
  { id: 'adminRoles', href: '/admin/roles', group: 'administration', labelFr: 'Rôles', requires: { resource: 'role', action: 'read' } },
  { id: 'adminOrganization', href: '/admin/organization', group: 'administration', labelFr: 'Structures', requires: { resource: 'organization_unit', action: 'create' } },
  { id: 'adminIntegrations', href: '/admin/integrations', group: 'administration', labelFr: 'Intégrations', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAi', href: '/admin/ai', group: 'administration', labelFr: 'IA', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminAudit', href: '/admin/audit', group: 'administration', labelFr: "Journal d'audit", requires: { resource: 'audit_log', action: 'read' } },
  { id: 'adminSecurity', href: '/admin/security', group: 'administration', labelFr: 'Sécurité', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminBackups', href: '/admin/backups', group: 'administration', labelFr: 'Sauvegardes', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminGdpr', href: '/admin/gdpr', group: 'administration', labelFr: 'RGPD', requires: { resource: 'setting', action: 'update' } },
  { id: 'adminSettings', href: '/admin/settings', group: 'administration', labelFr: 'Paramètres', requires: { resource: 'setting', action: 'update' } },
];

export const NAV_GROUP_LABELS = {
  me: 'Mon espace',
  manager: 'Encadrement',
  hr: 'Ressources humaines',
  steering: 'Pilotage',
  onboarding: 'Intégration',
  direction: 'Direction',
  references: 'Référentiels',
  tools: 'Outils',
  administration: 'Administration',
};
