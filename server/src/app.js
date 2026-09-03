import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { serverEnv } from './config/env.js';
import { attachUser } from './infrastructure/middleware/auth.js';

import authRoutes from './routes/auth.routes.js';
import organizationUnitsRoutes from './routes/organization-units.routes.js';
import usersRoutes from './routes/users.routes.js';
import positionsRoutes from './routes/positions.routes.js';
import assignmentsRoutes from './routes/assignments.routes.js';
import jobDescriptionsRoutes from './routes/job-descriptions.routes.js';
import competenciesRoutes from './routes/competencies.routes.js';
import assessmentsRoutes from './routes/assessments.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import kaizenRoutes from './routes/kaizen.routes.js';
import qmsRoutes from './routes/qms.routes.js';
import hseRoutes from './routes/hse.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import personalFilesRoutes from './routes/personal-files.routes.js';
import accountRequestsRoutes from './routes/account-requests.routes.js';
import recruitmentRoutes from './routes/recruitment.routes.js';
import companyRoutes from './routes/company.routes.js';
import strategyRoutes from './routes/strategy.routes.js';
import managementRoutes from './routes/management.routes.js';
import remarksRoutes from './routes/remarks.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import surveysRoutes from './routes/surveys.routes.js';
import trainingRoutes from './routes/training.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import auditRoutes from './routes/audit.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import navigationRoutes from './routes/navigation.routes.js';
import assistantRoutes from './routes/assistant.routes.js';
import adminRoutes from './routes/admin.routes.js';
import publicRoutes from './routes/public.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import adminConfigRoutes from './routes/admin-config.routes.js';
import questsRoutes from './routes/quests.routes.js';

export function createApp() {
  const app = express();
  const env = serverEnv();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get('/api/v1/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/organization-units', organizationUnitsRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/positions', positionsRoutes);
  app.use('/api/v1/assignments', assignmentsRoutes);
  app.use('/api/v1/job-descriptions', jobDescriptionsRoutes);
  app.use('/api/v1/competencies', competenciesRoutes);
  app.use('/api/v1/assessments', assessmentsRoutes);
  app.use('/api/v1/onboarding', onboardingRoutes);
  app.use('/api/v1/kaizen', kaizenRoutes);
  app.use('/api/v1/qms', qmsRoutes);
  app.use('/api/v1/hse', hseRoutes);
  app.use('/api/v1/contacts', contactsRoutes);
  app.use('/api/v1/documents', documentsRoutes);
  app.use('/api/v1/personal-files', personalFilesRoutes);
  app.use('/api/v1/account-requests', accountRequestsRoutes);
  app.use('/api/v1/recruitment', recruitmentRoutes);
  app.use('/api/v1/company', companyRoutes);
  app.use('/api/v1/strategy', strategyRoutes);
  app.use('/api/v1/management', managementRoutes);
  app.use('/api/v1/remarks', remarksRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/surveys', surveysRoutes);
  app.use('/api/v1/training', trainingRoutes);
  app.use('/api/v1/roles', rolesRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/upload', uploadRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/navigation', navigationRoutes);
  app.use('/api/v1/assistant', assistantRoutes);
  // Mounted ahead of adminRoutes on the same prefix, and the order matters: adminRoutes
  // gates its entire surface on setting:read via a router-level middleware, so anything
  // mounted behind it inherits that gate. These endpoints are each gated on the narrowest
  // permission that fits instead (role:* for the RBAC matrix, setting:update for platform
  // configuration), which only stays true if they are reached first. The two routers' paths
  // do not overlap — adminRoutes owns /integrations, /ai, /security, /backups, /gdpr and
  // /settings; this one owns /roles, /connectors, /ai/config, /security/policy,
  // /backups/schedules, /backups/runs and /gdpr/requests.
  app.use('/api/v1/admin', adminConfigRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/templates', templatesRoutes);
  app.use('/api/v1/alerts', alertsRoutes);
  app.use('/api/v1/quests', questsRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(err.status ?? 500).json({ error: err.message ?? 'internal-error' });
  });

  return app;
}
