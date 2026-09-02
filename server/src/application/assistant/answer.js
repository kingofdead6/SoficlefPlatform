import { AGENTS } from '../../domain/assistant/agents.js';
import { chat, isConfigured } from '../../infrastructure/ai/huggingface.js';
import { retrieveCompetencies } from './competencies.js';
import { retrieveDocuments } from './documents.js';
import { retrieveOnboarding } from './onboarding.js';
import { retrieveOrientation } from './orientation.js';
import { retrieveTraining } from './training.js';

/**
 * The one pipeline every assistant answer goes through.
 *
 * The ordering is the design, and it is not negotiable:
 *
 *   retrieve (scoped, always) -> nothing found? stop -> no key? answer from retrieval
 *                             -> otherwise let the model rephrase what retrieval found
 *
 * The model never touches the database and never chooses a source. It receives text that was
 * already fetched under the asker's own permissions, and its output is used for *phrasing
 * only* — `sources` is always the retrieval's own list. A model can hallucinate a citation;
 * retrieval cannot. Step 3 matters just as much: a model handed a question with no context
 * will compose a confident, entirely invented answer, which is precisely the failure this
 * design exists to prevent.
 */

const RETRIEVERS = {
  orientation: retrieveOrientation,
  documents: retrieveDocuments,
  onboarding: retrieveOnboarding,
  training: retrieveTraining,
  competencies: retrieveCompetencies,
};

/**
 * The system prompt. French, because the UI and the retrieved rows are French, and a model
 * asked to answer in French from French context drifts less than one asked to translate.
 */
const SYSTEM_PROMPT = [
  "Tu es l'assistant interne d'une plateforme RH. Tu réponds UNIQUEMENT à partir du contexte numéroté qui t'est fourni.",
  "Si le contexte ne contient pas la réponse, dis-le simplement et clairement, sans proposer d'hypothèse.",
  "N'invente jamais un nom, un chiffre, une date, une politique ou une procédure : rien qui ne figure pas dans le contexte.",
  'Cite les numéros des sources que tu utilises, sous la forme [1], [2].',
  'Réponds en français, de façon concise : 2 à 4 phrases au maximum.',
].join('\n');

/** The plain, model-free answer: the matched rows, one per line. What Agent 1 always did. */
function retrievalAnswer(snippets) {
  return snippets.map((snippet) => snippet.detail).join('\n');
}

function buildUserMessage(question, snippets) {
  const context = snippets
    .map((snippet, index) => `[${index + 1}] ${snippet.detail}`)
    .join('\n');

  return `Question : ${question}\n\nContexte :\n${context}`;
}

export async function answerWithAgent(user, agentId, question) {
  const agent = AGENTS[agentId];
  const retrieve = RETRIEVERS[agentId];

  if (!agent || !retrieve) {
    return { agent: agentId, answer: null, sources: [], reason: 'unknown-agent' };
  }

  // Always first. The model is never the thing that reaches for data.
  const { snippets, sources } = await retrieve(user, question);

  if (snippets.length === 0) {
    return { agent: agentId, answer: null, sources: [], grounded: true, model: null, reason: 'no-match' };
  }

  // No key is a supported state: the assistant stays fully useful, just plainer.
  if (!isConfigured()) {
    return {
      agent: agentId,
      answer: retrievalAnswer(snippets),
      sources,
      grounded: true,
      model: null,
    };
  }

  const result = await chat({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(question, snippets),
  });

  // A degraded answer beats an error. The reason travels with it so the UI can explain the
  // difference between "warming up, retry" and "it failed".
  if (!result.ok) {
    return {
      agent: agentId,
      answer: retrievalAnswer(snippets),
      sources,
      grounded: true,
      model: null,
      reason: result.reason,
    };
  }

  return {
    agent: agentId,
    answer: result.text,
    // From retrieval, never parsed out of the model's text.
    sources,
    grounded: true,
    model: 'hf',
  };
}
