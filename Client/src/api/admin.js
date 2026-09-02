import { api } from './client.js';

/**
 * The administration portal's endpoints (/api/v1/admin, route guide §2.4).
 *
 * The first block is the read-only reports that existed before (server admin.routes.js);
 * everything below it writes, against the tables added in the 20260903090000_admin_config
 * migration. The split mirrors the server's two routers exactly, so a reader can find the
 * handler for any call here by its path.
 */
export const adminApi = {
  // — Reports (GET only) —
  integrations: () => api.get('/admin/integrations'),
  ai: () => api.get('/admin/ai'),
  security: () => api.get('/admin/security'),
  backups: () => api.get('/admin/backups'),
  gdpr: () => api.get('/admin/gdpr'),
  settings: () => api.get('/admin/settings'),
  updateSetting: (key, value) => api.patch('/admin/settings', { key, value }),

  // — Custom roles (RBAC matrix) —
  customRoles: () => api.get('/admin/roles'),
  createCustomRole: (payload) => api.post('/admin/roles', payload),
  updateCustomRole: (id, payload) => api.patch(`/admin/roles/${id}`, payload),
  deleteCustomRole: (id) => api.delete(`/admin/roles/${id}`),

  // — Connectors (Plug & Play) —
  connectors: () => api.get('/admin/connectors'),
  updateConnector: (key, payload) => api.patch(`/admin/connectors/${key}`, payload),
  testConnector: (key) => api.post(`/admin/connectors/${key}/test`),

  // — AI configuration (stored, not consumed — ADR-003) —
  aiConfig: () => api.get('/admin/ai/config'),
  updateAiConfig: (payload) => api.patch('/admin/ai', payload),

  // — Security policy (recorded intent; the values in force come from security()) —
  securityPolicy: () => api.get('/admin/security/policy'),
  updateSecurityPolicy: (payload) => api.patch('/admin/security/policy', payload),

  // — Backups: schedules are real, runs are written by a worker that does not exist —
  backupSchedules: () => api.get('/admin/backups/schedules'),
  createBackupSchedule: (payload) => api.post('/admin/backups/schedules', payload),
  updateBackupSchedule: (id, payload) => api.patch(`/admin/backups/schedules/${id}`, payload),
  deleteBackupSchedule: (id) => api.delete(`/admin/backups/schedules/${id}`),
  backupRuns: (limit) => api.get(`/admin/backups/runs${limit ? `?limit=${limit}` : ''}`),

  // — GDPR register —
  gdprRequests: () => api.get('/admin/gdpr/requests'),
  createGdprRequest: (payload) => api.post('/admin/gdpr/requests', payload),
  updateGdprRequest: (id, payload) => api.patch(`/admin/gdpr/requests/${id}`, payload),
};
