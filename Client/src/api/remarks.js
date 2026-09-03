import { api } from './client.js';
import { API_URL } from '../../api.js';

const BASE_URL = API_URL;

export const remarksApi = {
  list: () => api.get('/remarks'),
  create: (contentFr) => api.post('/remarks', { contentFr }),
  remove: (id) => api.delete(`/remarks/${id}`),
  exportUrl: () => `${BASE_URL}/remarks/export`,
};
