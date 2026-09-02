import { api } from './client.js';

export const dashboardApi = {
  kpis: () => api.get('/dashboard'),
};
