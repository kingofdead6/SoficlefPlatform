import { api } from './client.js';

export const personalFilesApi = {
  mine: () => api.get('/personal-files/me'),
  listAll: () => api.get('/personal-files'),
  request: (payload) => api.post('/personal-files', payload),
  submit: (id, file, noteFr) => {
    const formData = new FormData();
    formData.append('file', file);
    if (noteFr) formData.append('noteFr', noteFr);
    return api.post(`/personal-files/${id}/submit`, formData);
  },
  review: (id, decision, noteFr) => api.patch(`/personal-files/${id}/review`, { decision, noteFr }),
};
