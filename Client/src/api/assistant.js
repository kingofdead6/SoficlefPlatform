import { api } from './client.js';

export const assistantApi = {
  /** The five agents, plus `provider`/`modelName` describing what is actually answering. */
  agents: () => api.get('/assistant/agents'),
  ask: (agentId, question) => api.post(`/assistant/${agentId}/ask`, { question }),
  /** Kept: the original Agent 1 path, still served as an alias. */
  askOrientation: (question) => api.post('/assistant/orientation/ask', { question }),
};
