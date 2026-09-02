import { api } from './client.js';

export const contactsApi = {
  list: () => api.get('/contacts'),
  create: (payload) => api.post('/contacts', payload),
  update: (id, payload) => api.patch(`/contacts/${id}`, payload),
  remove: (id) => api.delete(`/contacts/${id}`),
};
