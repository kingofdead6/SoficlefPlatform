import { api } from './client.js';

export const strategyApi = {
  get: () => api.get('/strategy'),
  updateContribution: (id, progressPercent) =>
    api.patch(`/strategy/contributions/${id}`, { progressPercent }),
};
