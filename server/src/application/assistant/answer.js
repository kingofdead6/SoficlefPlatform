import { AGENTS } from '../../domain/assistant/agents.js';
import { chat, isConfigured } from '../../infrastructure/ai/huggingface.js';
import { retrieveCompetencies } from './competencies.js';
import { retrieveDocuments } from './documents.js';
import { retrieveKnowledge } from './knowledge.js';
import { retrieveOnboarding } from './onboarding.js';
import { retrieveOrientation } from './orientation.js';
import { retrieveTraining } from './training.js';

/**
 * The one pipeline every assistant answer goes through.
 *
 * The ordering is the design, and it is not negotiable:
 *
 *   retrieve (scoped, always) -> nothing? try the platform knowledge base
 *                             -> still nothing? stop, or answer from general knowledge
 *                             -> no key? answer from retrieval verbatim
 *                             -> otherwise let the model rephrase what retrieval found
 *
 * The model never touches the database and never chooses a source. It receives text that was
 * already fetched under the asker's own permissions, and its output is used for *phrasing
 * only* — `sources` is always the retrieval's own list. A model can hallucinate a citation;
 * retrieval cannot. The final step matters just as much: a model handed a question with no
 * context will compose a confident, entirely invented answer, which is precisely the failure
 * this design exists to prevent.
 */

const RETRIEVERS = {
  orientation: retrieveOrientation,
  documents: retrieveDocuments,
  onboarding: retrieveOnboarding,
  training: retrieveTraining,
  competencies: retrieveCompetencies,
};

/**
 * The prompts are written in English even though the platform, its data and most of its users
 * are French.
 *
 * That is deliberate and it was measured. With French prompts carrying a French instruction to
 * "answer in the user's language", the model answered an English question in French and
 * produced a French/Arabic hybrid for an Arabic one — the sheer volume of French in the prompt
 * outweighed the one sentence asking for something else. An English instruction does not sit
 * on the scale for any of the three UI languages, so it is followed rather than absorbed.
 */

/** ISO-ish label for the script/language we detect, used to name the target explicitly. */
function detectLanguage(question) {
  const text = String(question ?? '');
  // Script first: it is unambiguous where word lists are not.
  if (/\p{Script=Arabic}/u.test(text)) return 'Arabic (العربية)';

  /*
   * Latin script: French and English share too much vocabulary for a general classifier to be
   * worth it here, so this looks for markers that are French and not English — accented
   * characters, and a handful of very common function words. Anything else is treated as
   * English, which is the safer default: the context is French, so a wrong guess of "French"
   * would simply never be corrected.
   */
  if (/[àâäçéèêëîïôöùûüÿœ]/i.test(text)) return 'French (français)';
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const frenchMarkers = new Set([
    'qui', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'est', 'sont', 'les', 'des', 'une',
    'dans', 'pour', 'comment', 'pourquoi', 'ou', 'mon', 'ma', 'mes', 'je', 'dois', 'faut',
    'combien', 'quand', 'avec', 'sur', 'que', 'ce', 'cette', 'du', 'de', 'la', 'le',
  ]);
  if (words.some((word) => frenchMarkers.has(word))) return 'French (français)';
  return 'English';
}

/**
 * The language rule, shared by both prompts.
 *
 * The detected language is named rather than left to inference: "reply in the user's language"
 * is a rule the model has to apply, where "reply in Arabic" is one it only has to follow. The
 * mirror instruction stays as a backstop for when detection is wrong.
 */
function languageRule(question) {
  const language = detectLanguage(question);
  return [
    `LANGUAGE — this rule outranks every other instruction. The user's question is in ${language}. You MUST write your entire answer in ${language}.`,
    'The retrieved context below is written in French. Translate the facts you use into the answer language. Do not copy French sentences into a non-French answer, and never answer in French unless the question itself is in French.',
    'Keep proper nouns, job titles, document titles and reference codes exactly as they appear — they identify real records.',
  ].join('\n');
}

/** The system prompt used whenever retrieval found something to ground the answer in. */
function systemPrompt(question) {
  return [
    "You are the internal assistant of SOFICLEF's HR platform. Answer ONLY from the numbered context you are given.",
    'If the context does not contain the answer, say so plainly. Do not guess and do not offer a hypothesis.',
    'Never invent a name, a number, a date, a policy or a procedure: nothing that is not in the context.',
    'Cite the numbers of the sources you use, as [1], [2].',
    'Be concise: 2 to 4 sentences maximum.',
    languageRule(question),
  ].join('\n');
}

/**
 * The ungrounded prompt, used only when neither the records nor the knowledge base matched.
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
function generalPrompt(question) {
  return [
    'You are the internal assistant of an HR platform (SOFICLEF, lock and key manufacturing in Algeria).',
    'No internal information matches this question, so answer from your general knowledge instead.',
    'You may explain general concepts (HR, quality, safety, training, common regulation).',
    'You must NEVER assert a SOFICLEF-specific fact: no person, no post holder, no figure, no date, no internal policy or procedure. You do not know them.',
    'If the question is about an internal fact, say clearly that this information is not in the platform and point the reader to HR or the relevant manager.',
    'Be concise: 2 to 4 sentences maximum.',
    languageRule(question),
  ].join('\n');
}

/** The plain, model-free answer: the matched rows, one per line. What Agent 1 always did. */
function retrievalAnswer(snippets) {
  return snippets.map((snippet) => snippet.detail).join('\n');
}

function buildUserMessage(question, snippets) {
  const context = snippets
    .map((snippet, index) => `[${index + 1}] ${snippet.detail}`)
    .join('\n');

  /*
   * The language target is repeated here, after the context, as well as in the system prompt.
   * The context is a block of French several times longer than the question, and whatever
   * instruction sits closest to the end of the prompt survives it best — without this line the
   * model reliably drifted back into French by the time it had read the sources.
   */
  return [
    `Question: ${question}`,
    '',
    'Context:',
    context,
    '',
    `Reminder: write your answer in ${detectLanguage(question)}, not in the language of the context above.`,
  ].join('\n');
}

export async function answerWithAgent(user, agentId, question) {
  const agent = AGENTS[agentId];
  const retrieve = RETRIEVERS[agentId];

  if (!agent || !retrieve) {
    return { agent: agentId, answer: null, sources: [], reason: 'unknown-agent' };
  }

  // Always first. The model is never the thing that reaches for data.
  let { snippets, sources } = await retrieve(user, question);

  /*
   * The agent's own records had nothing. Before falling through to general knowledge, try the
   * curated platform knowledge base: "what is a cellule", "how does the assistant work",
   * "is SOFICLEF certified" have real answers here, and answering them from the model's own
   * recollection is how an invented SOFICLEF fact reaches the reader.
   *
   * Deliberately second, not merged: a question a document can answer should cite that
   * document, not the paragraph describing the library.
   */
  if (snippets.length === 0) {
    ({ snippets, sources } = await retrieveKnowledge(user, question));
  }

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

    const general = await chat({
      system: generalPrompt(question),
      user: `Question: ${question}`,
    });

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
    system: systemPrompt(question),
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
