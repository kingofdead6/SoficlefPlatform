import { api } from './client.js';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export const remarksApi = {
  list: () => api.get('/remarks'),
  create: (contentFr) => api.post('/remarks', { contentFr }),
  remove: (id) => api.delete(`/remarks/${id}`),
  exportUrl: () => `${BASE_URL}/remarks/export`,
};
