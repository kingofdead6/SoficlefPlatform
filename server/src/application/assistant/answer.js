import { AGENTS } from '../../domain/assistant/agents.js';
import { chat, isConfigured } from '../../infrastructure/ai/huggingface.js';
import { retrieveCompetencies } from './competencies.js';
import { retrieveDocuments } from './documents.js';
import { retrieveOnboarding } from './onboarding.js';
import { retrieveOrientation } from './orientation.js';
import { retrieveTraining } from './training.js';
import { assistantLanguage } from './language.js';
import { isAgentEnabled, systemPromptFor } from './config.js';

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
 * The grounded system prompt, per language.
 *
 * Written out three times rather than composed from one template with a swapped final line.
 * A prompt is not a UI string: instructing a model in French to answer in Arabic is a weaker
 * constraint than instructing it in Arabic, and the rules that matter here — never invent a
 * name, never invent a figure, say so when the context does not answer — are exactly the ones
 * that must not weaken. The three read as the same instructions because they are.
 *
 * One rule is common to all three and is the reason the whole pipeline exists: the model
 * rephrases the numbered context and nothing else.
 */
const SYSTEM_PROMPTS = {
  fr: [
    "Tu es l'assistant interne d'une plateforme RH. Tu réponds UNIQUEMENT à partir du contexte numéroté qui t'est fourni.",
    "Si le contexte ne contient pas la réponse, dis-le simplement et clairement, sans proposer d'hypothèse.",
    "N'invente jamais un nom, un chiffre, une date, une politique ou une procédure : rien qui ne figure pas dans le contexte.",
    'Cite les numéros des sources que tu utilises, sous la forme [1], [2].',
    "Le contexte peut contenir des intitulés en français (titres de postes, noms de documents, références) : reprends-les tels quels, sans les traduire, pour qu'ils restent retrouvables dans la plateforme.",
    'Réponds en français, de façon concise : 2 à 4 phrases au maximum.',
  ],
  en: [
    'You are the internal assistant of an HR platform. You answer ONLY from the numbered context you are given.',
    'If the context does not contain the answer, say so plainly and clearly, without offering a guess.',
    'Never invent a name, a figure, a date, a policy or a procedure: nothing that is not in the context.',
    'Cite the numbers of the sources you use, in the form [1], [2].',
    'The context may contain French labels (job titles, document names, references): quote them exactly as they appear, without translating them, so they stay findable in the platform.',
    'Answer in English, concisely: 2 to 4 sentences at most.',
  ],
  ar: [
    'أنت المساعد الداخلي لمنصة الموارد البشرية. تجيب فقط انطلاقًا من السياق المرقَّم المقدَّم إليك.',
    'إذا لم يتضمن السياق الإجابة، قل ذلك بوضوح وبساطة، دون تقديم أي افتراض.',
    'لا تختلق أبدًا اسمًا أو رقمًا أو تاريخًا أو سياسة أو إجراءً: لا شيء خارج السياق.',
    'اذكر أرقام المصادر التي تستعملها بالشكل [1]، [2].',
    'قد يحتوي السياق على تسميات بالفرنسية (عناوين مناصب، أسماء وثائق، مراجع): أعد كتابتها كما هي دون ترجمة، حتى تبقى قابلة للبحث داخل المنصة.',
    'أجب بالعربية، باختصار: من جملتين إلى أربع جمل على الأكثر.',
  ],
};

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
const GENERAL_PROMPTS = {
  fr: [
    "Tu es l'assistant interne d'une plateforme RH (SOFICLEF, industrie de la serrurerie en Algérie).",
    "Aucune information interne ne correspond à cette question : réponds donc à partir de tes connaissances générales.",
    'Tu peux expliquer des notions générales (RH, qualité, sécurité, formation, réglementation usuelle).',
    "En revanche, tu ne dois JAMAIS affirmer un fait propre à SOFICLEF : ni nom de personne, ni poste occupé, ni chiffre, ni date, ni politique ou procédure interne. Tu ne les connais pas.",
    "Si la question porte sur un fait interne, dis clairement que cette information ne figure pas dans la plateforme et oriente vers les RH ou le responsable concerné.",
    'Réponds en français, de façon concise : 2 à 4 phrases au maximum.',
  ],
  en: [
    'You are the internal assistant of an HR platform (SOFICLEF, lock manufacturing, Algeria).',
    'No internal information matches this question, so answer from your general knowledge.',
    'You may explain general notions (HR, quality, safety, training, common regulation).',
    'You must NEVER state a fact specific to SOFICLEF: no person, no post held, no figure, no date, no internal policy or procedure. You do not know them.',
    'If the question is about an internal fact, say clearly that this information is not in the platform and point the reader to HR or the relevant manager.',
    'Answer in English, concisely: 2 to 4 sentences at most.',
  ],
  ar: [
    'أنت المساعد الداخلي لمنصة الموارد البشرية (SOFICLEF، صناعة الأقفال في الجزائر).',
    'لا توجد معلومة داخلية تطابق هذا السؤال، لذا أجب انطلاقًا من معارفك العامة.',
    'يمكنك شرح المفاهيم العامة (الموارد البشرية، الجودة، السلامة، التكوين، التنظيم المعمول به).',
    'لكن لا يجوز لك إطلاقًا تأكيد واقعة خاصة بـ SOFICLEF: لا اسم شخص، ولا منصب، ولا رقم، ولا تاريخ، ولا سياسة أو إجراء داخلي. أنت لا تعرفها.',
    'إذا كان السؤال يتعلق بواقعة داخلية، فقل بوضوح إن هذه المعلومة غير موجودة في المنصة ووجّه السائل إلى الموارد البشرية أو المسؤول المعني.',
    'أجب بالعربية، باختصار: من جملتين إلى أربع جمل على الأكثر.',
  ],
};

/** The word the user message labels its two halves with, per language. */
const MESSAGE_LABELS = {
  fr: { question: 'Question', context: 'Contexte' },
  en: { question: 'Question', context: 'Context' },
  ar: { question: 'السؤال', context: 'السياق' },
};

/** The plain, model-free answer: the matched rows, one per line. What Agent 1 always did. */
function retrievalAnswer(snippets) {
  return snippets.map((snippet) => snippet.detail).join('\n');
}

function buildUserMessage(question, snippets, language) {
  const labels = MESSAGE_LABELS[language];
  const context = snippets
    .map((snippet, index) => `[${index + 1}] ${snippet.detail}`)
    .join('\n');

  return `${labels.question} : ${question}\n\n${labels.context} :\n${context}`;
}

/**
 * @param {object} user      the asker; every retrieval runs under their own permissions
 * @param {string} agentId   one of AGENT_IDS
 * @param {string} question  what they typed
 * @param {string} [requestedLanguage]  the UI language to answer in ('fr' | 'en' | 'ar');
 *   anything unrecognised, including nothing at all, resolves to French
 */
export async function answerWithAgent(user, agentId, question, requestedLanguage) {
  const agent = AGENTS[agentId];
  const retrieve = RETRIEVERS[agentId];
  /*
   * Narrowed once, here, and passed down from this point on. Every branch below — retrieval
   * vocabulary, both prompts, the user message — reads this variable rather than the raw
   * argument, so there is exactly one place where an unsupported language becomes French and
   * no path can be reached with a value the tables do not have a key for.
   */
  const language = assistantLanguage(requestedLanguage);

  if (!agent || !retrieve) {
    return { agent: agentId, answer: null, sources: [], language, reason: 'unknown-agent' };
  }

  /*
   * Checked before retrieval, not after: a disabled agent must not read the database at all.
   * Answering from a query an administrator switched off — even to then discard the rows —
   * is the behaviour the switch exists to prevent.
   */
  if (!(await isAgentEnabled(agentId))) {
    return {
      agent: agentId,
      answer: null,
      sources: [],
      grounded: true,
      model: null,
      language,
      reason: 'agent-disabled',
    };
  }

  // Always first. The model is never the thing that reaches for data.
  const { snippets, sources } = await retrieve(user, question, language);

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
      return {
        agent: agentId,
        answer: null,
        sources: [],
        grounded: true,
        model: null,
        language,
        reason: 'no-match',
      };
    }

    const general = await chat({
      system: await systemPromptFor(agentId, GENERAL_PROMPTS[language].join('\n')),
      user: `${MESSAGE_LABELS[language].question} : ${question}`,
    });

    if (!general.ok) {
      return {
        agent: agentId,
        answer: null,
        sources: [],
        grounded: true,
        model: null,
        language,
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
      language,
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
      language,
    };
  }

  const result = await chat({
    system: await systemPromptFor(agentId, SYSTEM_PROMPTS[language].join('\n')),
    user: buildUserMessage(question, snippets, language),
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
      language,
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
    language,
  };
}
