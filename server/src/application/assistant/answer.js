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

/**
 * The ungrounded prompt, used only when retrieval found nothing in the platform.
 *
 * The distinction it has to hold is narrow but important. General professional knowledge —
 * what a probation period is, how ISO 9001 works, what an onboarding checklist usually
 * contains — is genuinely useful and safe to answer. A SOFICLEF-specific fact — who holds
 * a post, what this company's policy says, a figure from these records — is not, because
 * the model has no way to know it and an invented one is indistinguishable from a real one
 * to the reader.
 *
 * So the rule is not "never answer", it is "never answer *as if it came from here*".
 */
const GENERAL_PROMPT = [
  "Tu es l'assistant interne d'une plateforme RH (SOFICLEF, industrie de la serrurerie en Algérie).",
  "Aucune information interne ne correspond à cette question : réponds donc à partir de tes connaissances générales.",
  'Tu peux expliquer des notions générales (RH, qualité, sécurité, formation, réglementation usuelle).',
  "En revanche, tu ne dois JAMAIS affirmer un fait propre à SOFICLEF : ni nom de personne, ni poste occupé, ni chiffre, ni date, ni politique ou procédure interne. Tu ne les connais pas.",
  "Si la question porte sur un fait interne, dis clairement que cette information ne figure pas dans la plateforme et oriente vers les RH ou le responsable concerné.",
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

  /*
   * Nothing in the platform matched.
   *
   * Without a model there is nothing honest to say, so the caller still gets `no-match`.
   * With one, the model may answer from general knowledge — but the result carries
   * `grounded: false` and no sources, which is what lets the UI mark it as general
   * knowledge rather than letting it pass as a platform fact.
   */
  if (snippets.length === 0) {
    if (!isConfigured()) {
      return { agent: agentId, answer: null, sources: [], grounded: true, model: null, reason: 'no-match' };
    }

    const general = await chat({ system: GENERAL_PROMPT, user: `Question : ${question}` });

    if (!general.ok) {
      return {
        agent: agentId,
        answer: null,
        sources: [],
        grounded: true,
        model: null,
        reason: general.reason,
      };
    }

    return {
      agent: agentId,
      answer: general.text,
      // Deliberately empty: there is no platform source behind this answer, and inventing
      // one would defeat the whole point of the distinction.
      sources: [],
      grounded: false,
      model: 'hf',
    };
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
