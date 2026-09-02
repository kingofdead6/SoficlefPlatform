import { api } from './client.js';

export const managementApi = {
  get: () => api.get('/management'),
};
