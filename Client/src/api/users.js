import { api } from './client.js';

export const usersApi = {
  list: () => api.get('/users'),
  directory: (filters = {}) => {
    const params = new URLSearchParams({ view: 'directory', ...filters });
    return api.get(`/users?${params.toString()}`);
  },
  facets: () => api.get('/users/directory/facets'),
  /** The caller's own manager, structural peers and the key contacts. Never another user's. */
  myTeam: () => api.get('/users/me/team'),
  /** Sets the caller's own profile photo. 501 when no storage is configured. */
  uploadMyAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/me/avatar', formData);
  },
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  /** Bulk creation: all-or-nothing, with a per-row result (route guide §2.4). */
  import: (payload) => api.post('/users/import', payload),
  setStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  assignRole: (id, data) => api.post(`/users/${id}/roles`, data),
  /** Revokes every live session of an account. Issues no new password — no SMTP relay. */
  resetAccess: (id) => api.post(`/users/${id}/reset-access`),
};

export const rolesApi = {
  list: () => api.get('/roles'),
  scopes: () => api.get('/roles/scopes'),
};
