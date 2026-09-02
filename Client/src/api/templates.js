import { api } from './client.js';

/** Onboarding path templates and their milestone sequence (/api/v1/templates). */
export const templatesApi = {
  list: () => api.get('/templates'),
  get: (id) => api.get(`/templates/${id}`),
  create: (payload) => api.post('/templates', payload),
  saveMilestones: (id, milestones) => api.patch(`/templates/${id}/milestones`, { milestones }),
};
