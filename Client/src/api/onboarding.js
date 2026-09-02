import { api } from './client.js';

export const onboardingApi = {
  meOverview: () => api.get('/onboarding/me/overview'),
  journey: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/onboarding/journey${qs ? `?${qs}` : ''}`);
  },
  journeySummaries: () => api.get('/onboarding/journey/summaries'),
  /** Returns { instanceId, task, previousId, nextId, history, comments, signature }. */
  taskDetail: (milestoneId) => api.get(`/onboarding/journey/tasks/${milestoneId}`),
  setTaskStatus: (payload) => api.post('/onboarding/journey/tasks/status', payload),

  taskComments: (milestoneId) => api.get(`/onboarding/journey/tasks/${milestoneId}/comments`),
  postTaskComment: (milestoneId, bodyFr) =>
    api.post(`/onboarding/journey/tasks/${milestoneId}/comments`, { bodyFr }),
  /**
   * Records an acknowledgement of `statementFr` on this task. Not a qualified electronic
   * signature — see the server route and the task-detail page, both of which say so.
   */
  signTask: (milestoneId, statementFr) =>
    api.post(`/onboarding/journey/tasks/${milestoneId}/sign`, { statementFr }),

  managerDashboard: () => api.get('/onboarding/manager/dashboard'),
  managerRecruits: (includeArchived = false) =>
    api.get(`/onboarding/manager/recruits${includeArchived ? '?includeArchived=true' : ''}`),
  managerRecruit: (userId) => api.get(`/onboarding/manager/recruits/${userId}`),
  managerInterview: (userId) => api.get(`/onboarding/manager/interviews/${userId}`),

  /**
   * The HR trial-period review queue. Returns { data, thresholds } — the thresholds come
   * from the server's domain module so the page never hardcodes 60/30 of its own.
   */
  probationQueue: () => api.get('/onboarding/probation/queue'),
  probationDecisions: (instanceId) =>
    api.get(`/onboarding/probation/decisions?instanceId=${encodeURIComponent(instanceId)}`),
  decideProbation: (payload) => api.post('/onboarding/probation/decide', payload),

  evaluation: (id) => api.get(`/onboarding/evaluations/${id}`),
  saveEvaluation: (payload) => api.post('/onboarding/evaluations/save', payload),
  createManagerTask: (payload) => api.post('/onboarding/manager/tasks', payload),
};
