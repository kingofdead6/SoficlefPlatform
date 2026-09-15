import { api } from './client.js';

export const assistantApi = {
  /**
   * The five agents, plus `provider`/`modelName` describing what is actually answering and
   * `languages` listing what an answer can be asked for.
   */
  agents: () => api.get('/assistant/agents'),
  /**
   * Ask one agent.
   *
   * `language` is what the answer is written in — the retrieval vocabulary around the rows
   * and, when a model is configured, the language it is instructed to answer in. It is the
   * reader's UI language, not a browser header: someone reading the platform in Arabic wants
   * the answer in Arabic whatever their browser was installed with. The server falls back to
   * French for anything it does not recognise, so an omitted value is safe.
   */
  ask: (agentId, question, language) =>
    api.post(`/assistant/${agentId}/ask`, { question, language }),
  /** Kept: the original Agent 1 path, still served as an alias. */
  askOrientation: (question, language) =>
    api.post('/assistant/orientation/ask', { question, language }),
};
