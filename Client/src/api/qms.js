import { api } from './client.js';

export const qmsApi = {
  get: () => api.get('/qms'),
  update: (id, payload) => api.patch(`/qms/${id}`, payload),
  createProcess: (payload) => api.post('/qms/processes', payload),
};
