import { api } from './client.js';

export const trainingApi = {
  catalogue: () => api.get('/training'),
  coverage: () => api.get('/training/coverage'),
  module: (code) => api.get(`/training/${code}`),
  /** The caller's own certified modules (one row per module, newest first). */
  myCertificates: () => api.get('/training/certificates/me'),
  submitAttempt: (moduleId, answers) => api.post(`/training/${moduleId}/attempts`, { moduleId, answers }),
  createModule: (payload) => api.post('/training', payload),
  addQuestion: (moduleId, payload) => api.post(`/training/${moduleId}/questions`, payload),
};
