import { api } from './client.js';

export const jobDescriptionsApi = {
  list: () => api.get('/job-descriptions'),
  dossier: (id) => api.get(`/job-descriptions/${id}`),
  applyAction: (payload) => api.post('/job-descriptions/versions/action', payload),
  createDraft: (payload) => api.post('/job-descriptions/versions/draft', payload),
  create: (payload) => api.post('/job-descriptions', payload),
};
