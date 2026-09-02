import { api } from './client.js';

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.post('/notifications/mark-read', id ? { id } : {}),
};
