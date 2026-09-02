import { api } from './client.js';

export const organizationUnitsApi = {
  list: () => api.get('/organization-units'),
  get: (id) => api.get(`/organization-units/${id}`),
  create: (data) => api.post('/organization-units', data),
  update: (id, data) => api.patch(`/organization-units/${id}`, data),
  /** Archives a unit. Refused while it still holds live children or positions. */
  archive: (id) => api.delete(`/organization-units/${id}`),
  /** Folds `id` into `targetUnitId`: children, positions and scopes move, source archived. */
  merge: (id, targetUnitId) => api.post(`/organization-units/${id}/merge`, { targetUnitId }),
};

export const positionsApi = {
  list: () => api.get('/positions'),
  tree: () => api.get('/positions/tree'),
  get: (id) => api.get(`/positions/${id}`),
  create: (data) => api.post('/positions', data),
  update: (id, data) => api.patch(`/positions/${id}`, data),
  /** Reparenting, separated from update() because it carries the cycle guard. */
  reparent: (id, parentPositionId) => api.patch(`/positions/${id}/parent`, { parentPositionId }),
  archive: (id) => api.delete(`/positions/${id}`),
};

export const assignmentsApi = {
  list: () => api.get('/assignments'),
  pendingAccounts: () => api.get('/assignments/pending-accounts'),
  accountRequests: (limit) => api.get(`/assignments/account-requests${limit ? `?limit=${limit}` : ''}`),
  vacantPositions: () => api.get('/assignments/vacant-positions'),
  assign: (data) => api.post('/assignments', data),
  end: (id, endDate) => api.patch(`/assignments/${id}/end`, { endDate }),
};
