import { useTranslation } from 'react-i18next';

/**
 * How an agent is named on screen.
 *
 * `GET /assistant/agents` returns a `labelKey` per agent rather than a title and a purpose
 * sentence: which agents exist is the server's fact, how they read is the interface's. This
 * hook is the one place that turns the key into the two strings every assistant page shows,
 * so the five agents are described identically on the employee page, the manager page and
 * HR's test bench — which is exactly what drifted when each page held its own copy.
 */
export function useAgentLabels() {
  const { t } = useTranslation();

  return (agent) => {
    if (!agent?.labelKey) return { title: '', purpose: '' };
    return {
      title: t(`${agent.labelKey}.title`),
      purpose: t(`${agent.labelKey}.purpose`),
    };
  };
}
