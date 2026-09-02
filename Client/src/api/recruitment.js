import { api } from './client.js';

export const recruitmentApi = {
  get: () => api.get('/recruitment'),
  update: (id, payload) => api.patch(`/recruitment/${id}`, payload),
  createPosition: (payload) => api.post('/recruitment/positions', payload),
  updatePosition: (id, payload) => api.patch(`/recruitment/positions/${id}`, payload),
  deletePosition: (id) => api.delete(`/recruitment/positions/${id}`),
};
