import { api } from './client.js';

export const hseApi = {
  get: () => api.get('/hse'),
  update: (id, payload) => api.patch(`/hse/${id}`, payload),
  createRule: (payload) => api.post('/hse/rules', payload),
};
