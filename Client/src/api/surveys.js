import { api } from './client.js';

export const surveysApi = {
  myRounds: () => api.get('/surveys/me'),
  satisfaction: () => api.get('/surveys/satisfaction'),
  results: (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );
    const qs = params.toString();
    return api.get(`/surveys/results${qs ? `?${qs}` : ''}`);
  },
  submitResponse: (payload) => api.post('/surveys/responses', payload),
};
