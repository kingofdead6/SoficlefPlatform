import { api } from './client.js';

export const auditApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')),
    );
    const qs = params.toString();
    return api.get(`/audit${qs ? `?${qs}` : ''}`);
  },
  console: () => api.get('/audit/console'),
  sessions: (limit) => api.get(`/audit/console/sessions${limit ? `?limit=${limit}` : ''}`),
  provisioning: () => api.get('/audit/console/provisioning'),
};
