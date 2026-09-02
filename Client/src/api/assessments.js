import { api } from './client.js';

export const assessmentsApi = {
  list: (userId) => api.get(`/assessments${userId ? `?userId=${userId}` : ''}`),
  record: (payload) => api.post('/assessments', payload),
};
