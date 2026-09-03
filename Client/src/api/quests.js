import { api } from './client.js';

export const questsApi = {
  list: () => api.get('/quests'),
  assignable: () => api.get('/quests/assignable'),
  create: (payload) => api.post('/quests', payload),
  update: (id, payload) => api.put(`/quests/${id}`, payload),
  setStatus: (id, status) => api.patch(`/quests/${id}/status`, { status }),
  remove: (id) => api.delete(`/quests/${id}`),
};
