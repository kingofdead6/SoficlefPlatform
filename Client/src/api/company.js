import { api } from './client.js';

export const companyApi = {
  get: () => api.get('/company'),
  update: (id, payload) => api.patch(`/company/${id}`, payload),
};
