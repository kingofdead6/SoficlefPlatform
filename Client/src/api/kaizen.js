import { api } from './client.js';

export const kaizenApi = {
  programme: () => api.get('/kaizen/programme'),
  statuses: () => api.get('/kaizen/statuses'),
  setActionStatus: (id, statusFr) => api.patch(`/kaizen/actions/${id}/status`, { statusFr }),
  createAction: (payload) => api.post('/kaizen/actions', payload),
  deleteAction: (id) => api.delete(`/kaizen/actions/${id}`),
};
