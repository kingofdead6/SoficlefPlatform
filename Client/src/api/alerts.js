import { api } from './client.js';

/** The HR reminder/escalation rules engine (/api/v1/alerts). */
export const alertsApi = {
  rules: () => api.get('/alerts/rules'),
  createRule: (payload) => api.post('/alerts/rules', payload),
  updateRule: (id, payload) => api.patch(`/alerts/rules/${id}`, payload),
  deleteRule: (id) => api.delete(`/alerts/rules/${id}`),
};
