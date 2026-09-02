import { api } from './client.js';

export const accountRequestsApi = {
  list: () => api.get('/account-requests'),
  create: (payload) => api.post('/account-requests', payload),
};
