import { api } from './client.js';

export const documentsApi = {
  list: () => api.get('/documents'),
  mine: () => api.get('/documents/me'),
  get: (id) => api.get(`/documents/${id}`),
  create: (payload) => api.post('/documents', payload),
  update: (id, payload) => api.patch(`/documents/${id}`, payload),
  upload: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/documents/${id}/upload`, formData);
  },
  /** Real department names (User.directionFr / serviceFr) offered by the publish control. */
  departments: () => api.get('/documents/departments'),
  /** Accept → publish: flips to AVAILABLE and applies the audience in one audited call. */
  publish: (id, payload) => api.post(`/documents/${id}/publish`, payload),
  acknowledge: (id) => api.post(`/documents/${id}/acknowledge`),
};
