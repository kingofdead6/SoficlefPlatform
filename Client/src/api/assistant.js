import { api } from './client.js';

export const assistantApi = {
  /**
   * The five agents, plus `provider`/`modelName` describing what is actually answering and
   * `suggestions` — starter questions built from real rows.
   *
   * `lang` is the *UI* language, not the browser's: the suggestions come back phrased in it,
   * so it has to follow the in-app switcher rather than Accept-Language.
   */
  agents: (lang) => api.get(`/assistant/agents${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`),
  ask: (agentId, question) => api.post(`/assistant/${agentId}/ask`, { question }),
  /** Kept: the original Agent 1 path, still served as an alias. */
  askOrientation: (question) => api.post('/assistant/orientation/ask', { question }),
};
