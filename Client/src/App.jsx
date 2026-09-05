import { Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { NotificationsProvider } from './notifications/NotificationsContext.jsx';
import { AppShell } from './components/shell/AppShell.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import PendingPage from './pages/PendingPage.jsx';
import MeDashboardPage from './pages/dashboard/MeDashboardPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import OrganizationPage from './pages/organization/OrganizationPage.jsx';
import HrDashboardPage from './pages/hr/HrDashboardPage.jsx';
import HrEmployeesPage from './pages/hr/employees/HrEmployeesPage.jsx';
import HrUnassignedPage from './pages/hr/employees/HrUnassignedPage.jsx';
import HrAssignEmployeePage from './pages/hr/employees/HrAssignEmployeePage.jsx';
import HrEmployeeDetailPage from './pages/hr/employees/HrEmployeeDetailPage.jsx';
import HrRequestAccountPage from './pages/hr/employees/HrRequestAccountPage.jsx';
import HrPositionsPage from './pages/hr/positions/HrPositionsPage.jsx';
import HrProbationPage from './pages/hr/probation/HrProbationPage.jsx';
import HrOrganigramPage from './pages/hr/organigram/HrOrganigramPage.jsx';
import HrTemplatesPage from './pages/hr/templates/HrTemplatesPage.jsx';
import HrTemplateBuilderPage from './pages/hr/templates/HrTemplateBuilderPage.jsx';
import HrDocumentsPage from './pages/hr/documents/HrDocumentsPage.jsx';
import HrTrainingPage from './pages/hr/training/HrTrainingPage.jsx';
import HrQuizBuilderPage from './pages/hr/training/HrQuizBuilderPage.jsx';
import HrSurveysPage from './pages/hr/surveys/HrSurveysPage.jsx';
import HrSurveyResultsPage from './pages/hr/surveys/HrSurveyResultsPage.jsx';
import HrAnalyticsPage from './pages/hr/analytics/HrAnalyticsPage.jsx';
import HrReportBuilderPage from './pages/hr/analytics/HrReportBuilderPage.jsx';
import HrAlertsPage from './pages/hr/alerts/HrAlertsPage.jsx';
import HrAiKnowledgePage from './pages/hr/ai/HrAiKnowledgePage.jsx';
import AdminConsolePage from './pages/admin/AdminConsolePage.jsx';
import AdminUsersPage from './pages/admin/users/AdminUsersPage.jsx';
import AdminProvisioningPage from './pages/admin/users/AdminProvisioningPage.jsx';
import AdminOrganizationPage from './pages/admin/organization/AdminOrganizationPage.jsx';
import AdminRolesPage from './pages/admin/roles/AdminRolesPage.jsx';
import AdminAuditPage from './pages/admin/audit/AdminAuditPage.jsx';
import AdminSettingsPage from './pages/admin/settings/AdminSettingsPage.jsx';

import JourneyPage from './pages/me/journey/JourneyPage.jsx';
import TaskDetailPage from './pages/me/journey/TaskDetailPage.jsx';
import MeOrganigramPage from './pages/me/organigram/MeOrganigramPage.jsx';
import MeDocumentsPage from './pages/me/documents/MeDocumentsPage.jsx';
import MeTeamPage from './pages/me/team/MeTeamPage.jsx';
import MeAssistantPage from './pages/me/assistant/MeAssistantPage.jsx';
import PositionPage from './pages/me/position/PositionPage.jsx';
import TrainingCataloguePage from './pages/me/training/TrainingCataloguePage.jsx';
import TrainingModulePage from './pages/me/training/TrainingModulePage.jsx';
import CertificatesPage from './pages/me/training/CertificatesPage.jsx';
import MeSurveysPage from './pages/me/surveys/SurveysPage.jsx';

import ManagerDashboardPage from './pages/manager/ManagerDashboardPage.jsx';
import RecruitsPage from './pages/manager/recruits/RecruitsPage.jsx';
import RecruitDetailPage from './pages/manager/recruits/RecruitDetailPage.jsx';
import AssignTaskPage from './pages/manager/recruits/AssignTaskPage.jsx';
import ManagerOrganigramPage from './pages/manager/organigram/ManagerOrganigramPage.jsx';
import EvaluationsPage from './pages/manager/evaluations/EvaluationsPage.jsx';
import EvaluationDetailPage from './pages/manager/evaluations/EvaluationDetailPage.jsx';
import InterviewPrepPage from './pages/manager/interviews/InterviewPrepPage.jsx';
import TeamPage from './pages/manager/team/TeamPage.jsx';
import ManagerReportsPage from './pages/manager/reports/ManagerReportsPage.jsx';
import ManagerAssistantPage from './pages/manager/assistant/ManagerAssistantPage.jsx';
import ManagerCalendarPage from './pages/manager/calendar/ManagerCalendarPage.jsx';
import ManagerDocumentsPage from './pages/manager/documents/ManagerDocumentsPage.jsx';
import ManagerArchivePage from './pages/manager/archive/ManagerArchivePage.jsx';
import ManagerSettingsPage from './pages/manager/settings/ManagerSettingsPage.jsx';
import ManagerJobDescriptionsPage from './pages/manager/job-descriptions/ManagerJobDescriptionsPage.jsx';
import ManagerQuestsPage from './pages/manager/quests/ManagerQuestsPage.jsx';
import MeQuestsPage from './pages/me/quests/MeQuestsPage.jsx';

import CompetenciesPage from './pages/competencies/CompetenciesPage.jsx';
import JobDescriptionListPage from './pages/job-description/JobDescriptionListPage.jsx';
import JobDescriptionDossierPage from './pages/job-description/JobDescriptionDossierPage.jsx';
import TrainingPage from './pages/training/TrainingPage.jsx';
import SurveysReportPage from './pages/surveys/SurveysReportPage.jsx';
import OnboardingChecklistPage from './pages/onboarding/OnboardingChecklistPage.jsx';
import WelcomePage from './pages/welcome/WelcomePage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import IntegrationsPage from './pages/admin/integrations/IntegrationsPage.jsx';
import AiConfigPage from './pages/admin/ai/AiConfigPage.jsx';
import SecurityPage from './pages/admin/security/SecurityPage.jsx';
import BackupsPage from './pages/admin/backups/BackupsPage.jsx';
import GdprPage from './pages/admin/gdpr/GdprPage.jsx';
import PublicLayout from './pages/public/PublicLayout.jsx';
import Home from './pages/public/Home.jsx';
import Entreprise from './pages/public/Entreprise.jsx';
import Strategie from './pages/public/Strategie.jsx';
import Organigramme from './pages/public/Organigramme.jsx';
import KaizenPage from './pages/kaizen/KaizenPage.jsx';
import QmsPage from './pages/qms/QmsPage.jsx';
import HsePage from './pages/hse/HsePage.jsx';
import ContactsPage from './pages/contacts/ContactsPage.jsx';
import DocumentsPage from './pages/documents/DocumentsPage.jsx';
import MyFilesPage from './pages/me/files/MyFilesPage.jsx';
import RecruitmentPage from './pages/recruitment/RecruitmentPage.jsx';
import CompanyPage from './pages/company/CompanyPage.jsx';
import StrategyPage from './pages/strategy/StrategyPage.jsx';
import ManagementPage from './pages/management/ManagementPage.jsx';
import RemarksPage from './pages/remarks/RemarksPage.jsx';

/**
 * Route tree, mirroring SoficlefPlatform's src/app/[locale]/(app) and (public) groups
 * minus the [locale] segment (French-only, per the migration brief). Feature routes are
 * added here domain-by-domain as their pages are built; ProtectedRoute is the client
 * courtesy-guard matching the source app's (app)/layout.tsx.
 */
export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/entreprise" element={<Entreprise />} />
          <Route path="/strategie" element={<Strategie />} />
          <Route path="/organigramme" element={<Organigramme />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/pending" element={<PendingPage />} />

          <Route element={<AppShell />}>
            <Route path="/app/me" element={<MeDashboardPage />} />
            <Route path="/app/notifications" element={<NotificationsPage />} />
            {/*
              The New Hire portal's assistant (route guide §2.1) is its own page rather than
              the generic shared one: §2.1 asks for Agent 1 plus the Agent 2 D+15 check-in
              specifically, exactly as the manager portal has its own §2.2 assistant. The
              shared pages/assistant/AssistantPage.jsx is now unrouted — it is the generic
              five-agent overview, kept in the tree for whichever portal claims it next.
            */}
            <Route path="/app/me/assistant" element={<MeAssistantPage />} />


            <Route element={<ProtectedRoute requires={{ resource: 'setting', action: 'update' }} />}>
              <Route path="/admin/integrations" element={<IntegrationsPage />} />
              <Route path="/admin/ai" element={<AiConfigPage />} />
              <Route path="/admin/security" element={<SecurityPage />} />
              <Route path="/admin/backups" element={<BackupsPage />} />
              <Route path="/admin/gdpr" element={<GdprPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'document', action: 'read' }} />}>
              <Route path="/app/me/files" element={<MyFilesPage />} />
              {/* §2.1 CHAIN/SITE: the reference library plus the read-and-accepted record. */}
              <Route path="/app/me/documents" element={<MeDocumentsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'kaizen_action', action: 'read' }} />}>
              <Route path="/kaizen" element={<KaizenPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'document', action: 'read' }} />}>
              <Route path="/qms" element={<QmsPage />} />
              <Route path="/hse" element={<HsePage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'dashboard', action: 'read' }} />}>
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/company" element={<CompanyPage />} />
              <Route path="/strategy" element={<StrategyPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'organization_unit', action: 'read' }} />}>
              {/*
                §2.1 CHAIN/CORE and SITE. Both are self-anchored server-side — the org chart
                by getVisibleTree's own windowing, the team page by GET /users/me/team
                resolving from the caller's id — so this gate is the same permission the
                sidebar entries already declare.
              */}
              <Route path="/app/me/organigram" element={<MeOrganigramPage />} />
              <Route path="/app/me/team" element={<MeTeamPage />} />
              <Route path="/management" element={<ManagementPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'job', action: 'read' }} />}>
              <Route path="/recruitment" element={<RecruitmentPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'remark', action: 'read' }} />}>
              <Route path="/remarks" element={<RemarksPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'onboarding_task', action: 'read' }} />}>
              <Route path="/app/me/journey" element={<JourneyPage />} />
              {/*
                §2.1 CORE. Declared after the bare /app/me/journey path so the roadmap is not
                matched as a task id; the param is a milestone uuid, resolved server-side
                against the caller's own journey.
              */}
              <Route path="/app/me/journey/:taskId" element={<TaskDetailPage />} />
              <Route path="/onboarding" element={<OnboardingChecklistPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'quest', action: 'read' }} />}>
              <Route path="/app/me/quests" element={<MeQuestsPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'job_description', action: 'read' }} />}>
              <Route path="/app/me/position" element={<PositionPage />} />
              <Route path="/job-description" element={<JobDescriptionListPage />} />
              <Route path="/job-description/:id" element={<JobDescriptionDossierPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'training', action: 'read' }} />}>
              <Route path="/app/me/training" element={<TrainingCataloguePage />} />
              {/*
                §2.1 SITE. Declared before /app/me/training/:code so "certificates" is not
                swallowed as a module code — the same ordering the server route file uses.
              */}
              <Route path="/app/me/training/certificates" element={<CertificatesPage />} />
              <Route path="/app/me/training/:code" element={<TrainingModulePage />} />
              <Route path="/training" element={<TrainingPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'survey', action: 'read' }} />}>
              <Route path="/app/me/surveys" element={<MeSurveysPage />} />
              <Route path="/surveys" element={<SurveysReportPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'competency', action: 'read' }} />}>
              <Route path="/competencies" element={<CompetenciesPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'onboarding_instance', action: 'read' }} />}>
              <Route path="/welcome" element={<WelcomePage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'onboarding_task', action: 'validate' }} />}>
              <Route path="/app/manager" element={<ManagerDashboardPage />} />
              <Route path="/app/manager/recruits" element={<RecruitsPage />} />
              <Route path="/app/manager/recruits/:userId" element={<RecruitDetailPage />} />
              <Route path="/app/manager/recruits/:userId/tasks/new" element={<AssignTaskPage />} />
              <Route path="/app/manager/organigram" element={<ManagerOrganigramPage />} />
              <Route path="/app/manager/evaluations" element={<EvaluationsPage />} />
              <Route path="/app/manager/evaluations/:id" element={<EvaluationDetailPage />} />
              <Route path="/app/manager/interviews/:userId" element={<InterviewPrepPage />} />
              <Route path="/app/manager/team" element={<TeamPage />} />
              <Route path="/app/manager/reports" element={<ManagerReportsPage />} />
              <Route path="/app/manager/assistant" element={<ManagerAssistantPage />} />
              <Route path="/app/manager/calendar" element={<ManagerCalendarPage />} />
              <Route path="/app/manager/documents" element={<ManagerDocumentsPage />} />
              <Route path="/app/manager/archive" element={<ManagerArchivePage />} />
              <Route path="/app/manager/settings" element={<ManagerSettingsPage />} />
              <Route path="/app/manager/job-descriptions" element={<ManagerJobDescriptionsPage />} />
              <Route path="/app/manager/quests" element={<ManagerQuestsPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'dashboard', action: 'read' }} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'organization_unit', action: 'read' }} />}>
              <Route path="/organization" element={<OrganizationPage />} />
            </Route>

            {/*
              HR portal (route guide §2.3). Each page is gated on the permission its own API
              calls actually require, not on one blanket HR gate:
                - the provisioning chain (dashboard, directory, assignment, positions,
                  organigram, templates) needs assignment:create, which is what defines HR;
                - the document library needs document:create;
                - training needs training:read;
                - the survey pages and the alert rules engine need survey:read
                  (the rules engine's writes are re-checked server-side against survey:update);
                - analytics and the AI knowledge page need dashboard:read.
              The static /app/hr/employees/{unassigned,request} paths are declared before the
              /app/hr/employees/:id parameterised route so they are not swallowed by it.
            */}
            <Route element={<ProtectedRoute requires={{ resource: 'assignment', action: 'create' }} />}>
              <Route path="/app/hr" element={<HrDashboardPage />} />
              <Route path="/app/hr/employees" element={<HrEmployeesPage />} />
              <Route path="/app/hr/employees/unassigned" element={<HrUnassignedPage />} />
              <Route path="/app/hr/employees/request" element={<HrRequestAccountPage />} />
              <Route path="/app/hr/employees/:id" element={<HrEmployeeDetailPage />} />
              <Route path="/app/hr/employees/:id/assign" element={<HrAssignEmployeePage />} />
              <Route path="/app/hr/positions" element={<HrPositionsPage />} />
              <Route path="/app/hr/probation" element={<HrProbationPage />} />
              <Route path="/app/hr/organigram" element={<HrOrganigramPage />} />
              <Route path="/app/hr/templates" element={<HrTemplatesPage />} />
              <Route path="/app/hr/templates/:id" element={<HrTemplateBuilderPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'document', action: 'create' }} />}>
              <Route path="/app/hr/documents" element={<HrDocumentsPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'training', action: 'read' }} />}>
              <Route path="/app/hr/training" element={<HrTrainingPage />} />
              <Route path="/app/hr/training/:id/quiz" element={<HrQuizBuilderPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'survey', action: 'read' }} />}>
              <Route path="/app/hr/surveys" element={<HrSurveysPage />} />
              <Route path="/app/hr/surveys/results" element={<HrSurveyResultsPage />} />
              <Route path="/app/hr/alerts" element={<HrAlertsPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'dashboard', action: 'read' }} />}>
              <Route path="/app/hr/analytics" element={<HrAnalyticsPage />} />
              <Route path="/app/hr/analytics/reports" element={<HrReportBuilderPage />} />
              <Route path="/app/hr/ai-knowledge" element={<HrAiKnowledgePage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'user', action: 'read' }} />}>
              <Route path="/admin" element={<AdminConsolePage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'user', action: 'create' }} />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/provisioning" element={<AdminProvisioningPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'organization_unit', action: 'create' }} />}>
              <Route path="/admin/organization" element={<AdminOrganizationPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'role', action: 'read' }} />}>
              <Route path="/admin/roles" element={<AdminRolesPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'audit_log', action: 'read' }} />}>
              <Route path="/admin/audit" element={<AdminAuditPage />} />
            </Route>

            <Route element={<ProtectedRoute requires={{ resource: 'setting', action: 'update' }} />}>
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<LoginPage />} />
      </Routes>
      </NotificationsProvider>
    </AuthProvider>
  );
}
