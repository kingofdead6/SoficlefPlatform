import { api } from './client.js';

export const competenciesApi = {
  matrix: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/competencies/matrix${qs ? `?${qs}` : ''}`);
  },
  positions: () => api.get('/competencies/positions'),
  list: () => api.get('/competencies'),
  families: () => api.get('/competencies/families'),
  levels: () => api.get('/competencies/levels'),
  create: (payload) => api.post('/competencies', payload),
  update: (id, payload) => api.patch(`/competencies/${id}`, payload),
  remove: (id) => api.delete(`/competencies/${id}`),
  setJobCompetency: (payload) => api.post('/competencies/job-competencies', payload),
};
