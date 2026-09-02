import { api } from './client.js';

export const settingsApi = {
  list: () => api.get('/settings'),
  update: (key, value) => api.patch(`/settings/${key}`, { value }),
};
