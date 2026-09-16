import { canAnyScope } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';
import { loadCatalogue } from '../training/catalogue.js';
import { loadJourney } from '../onboarding/journey.js';
import { audienceFilter } from '../documents/audience.js';
import { getVisibleTree } from '../../infrastructure/repositories/position-repository.js';

/**
 * The starter questions shown under the ask box.
 *
 * These used to be hardcoded strings in the client catalogues, and they had drifted into
 * fiction: the employee page offered « Où est la charte informatique ? » and « Quelle
 * procédure pour les congés ? » for documents that do not exist in this platform. A
 * suggestion is a promise — the reader clicks it expecting an answer — so a suggestion that
 * retrieval cannot answer is worse than no suggestion at all.
 *
 * So each one is now built from a row that was actually found, under the caller's own scope
 * and using the same loaders the retrievers use. A suggestion is only offered when the thing
 * it asks about exists and the asker may see it; when nothing qualifies, the agent simply
 * gets no chips rather than a plausible-looking guess.
 *
 * The chips are phrased in the reader's UI language (`lang`), while the row label inside them
 * — a document title, a post, a module — stays in French, because that is what the record
 * actually says and what retrieval will match when the chip is clicked. A chip reading
 * "Where can I find « Règlement intérieur SOFICLEF »?" is the honest shape: the question is
 * the reader's, the name is the platform's.
 */

/** How many chips one agent is worth. More than three reads as a menu, not as a hint. */
const PER_AGENT = 3;

/** The three UI languages. Anything else falls back to French, as the rest of the app does. */
const LANGUAGES = ['fr', 'en', 'ar'];

/**
 * Chip phrasings, one per language.
 *
 * Kept here rather than in the client catalogues because the sentence and the row it is built
 * around are assembled together: splitting them would mean shipping "{{title}}" placeholders
 * to three JSON files and reassembling them in the page, which is how the previous generic
 * chips drifted out of step with the data in the first place.
 *
 * Every interpolated name is quoted, without exception. The record names stay French inside a
 * non-French sentence, and `detectLanguage` (answer.js) strips quoted spans before deciding
 * what language the question is in — so an unquoted « ... de la plateforme » in an English
 * chip would read as French and be answered in French. The quotes are what keep a clicked
 * chip answering in the language it was displayed in.
 */
const PHRASES = {
  fr: {
    whoHolds: (title) => `Qui occupe le poste de « ${title} » ?`,
    whoToAsk: (role) => `À qui m'adresser pour « ${role} » ?`,
    whereIsDoc: (title) => `Où trouver « ${title} » ?`,
    journeyRemaining: 'Que me reste-t-il à faire dans mon parcours ?',
    journeyOverdue: 'Qu’est-ce qui est en retard ?',
    journeyTask: (title) => `Où en est « ${title} » ?`,
    mandatoryModules: 'Quels modules de formation sont obligatoires ?',
    passingScore: (title) => `Quel est le seuil de réussite de « ${title} » ?`,
    myTrainingProgress: 'Où en suis-je dans mes formations ?',
    whatIsModule: (title) => `En quoi consiste « ${title} » ?`,
    skillsForPost: (title) => `Quelles compétences demande le poste de « ${title} » ?`,
    mySkillGaps: 'Quels sont mes écarts de compétences ?',
  },
  en: {
    whoHolds: (title) => `Who holds the position of “${title}”?`,
    whoToAsk: (role) => `Who should I contact about “${role}”?`,
    whereIsDoc: (title) => `Where can I find “${title}”?`,
    journeyRemaining: 'What is left to do in my onboarding journey?',
    journeyOverdue: 'What is overdue?',
    journeyTask: (title) => `What is the status of “${title}”?`,
    mandatoryModules: 'Which training modules are mandatory?',
    passingScore: (title) => `What is the passing score for “${title}”?`,
    myTrainingProgress: 'How far along am I in my training?',
    whatIsModule: (title) => `What does “${title}” cover?`,
    skillsForPost: (title) => `Which skills does the position of “${title}” require?`,
    mySkillGaps: 'What are my competency gaps?',
  },
  ar: {
    whoHolds: (title) => `من يشغل منصب «${title}»؟`,
    whoToAsk: (role) => `بمن أتصل بخصوص «${role}»؟`,
    whereIsDoc: (title) => `أين أجد «${title}»؟`,
    journeyRemaining: 'ما الذي تبقى لي في مسار الإدماج؟',
    journeyOverdue: 'ما هي المهام المتأخرة؟',
    journeyTask: (title) => `ما هي حالة «${title}»؟`,
    mandatoryModules: 'ما هي الدورات التكوينية الإجبارية؟',
    passingScore: (title) => `ما هي درجة النجاح في «${title}»؟`,
    myTrainingProgress: 'ما هو تقدمي في التكوين؟',
    whatIsModule: (title) => `ماذا تتضمن «${title}»؟`,
    skillsForPost: (title) => `ما هي الكفاءات التي يتطلبها منصب «${title}»؟`,
    mySkillGaps: 'ما هي فجوات الكفاءات لدي؟',
  },
};

/** Resolves an arbitrary caller-supplied tag ("en-GB", "AR", null) onto a supported set. */
export function resolveLanguage(lang) {
  const code = String(lang ?? '').trim().toLowerCase().slice(0, 2);
  return LANGUAGES.includes(code) ? code : 'fr';
}

/** Trims a label so a chip stays a chip: long titles are cut on a word boundary. */
function shorten(value, max = 48) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

async function orientationSuggestions(user, phrases) {
  const [tree, contacts] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    prisma.contact
      .findMany({ select: { roleFr: true }, orderBy: { order: 'asc' }, take: 12 })
      .catch(() => []),
  ]);

  const questions = [];

  /*
   * Filled posts first: "qui est Responsable HSE" has a name behind it, where the same
   * question about a vacant post answers "poste vacant". Both are true answers, but the
   * first is the better advertisement for what the agent does.
   */
  for (const node of tree) {
    if (!node.holder) continue;
    questions.push(phrases.whoHolds(shorten(node.titleFr)));
    if (questions.length >= 2) break;
  }

  for (const contact of contacts) {
    if (questions.length >= PER_AGENT) break;
    questions.push(phrases.whoToAsk(shorten(contact.roleFr)));
  }

  return questions.slice(0, PER_AGENT);
}

async function documentSuggestions(user, phrases) {
  if (!canAnyScope(user, 'read', 'document')) return [];

  const scoped = audienceFilter(user);
  const documents = await prisma.document
    .findMany({
      where: { ...(scoped ?? {}) },
      // Published documents first: a chip that leads to "en attente de publication" is a
      // correct answer but a disappointing first impression.
      orderBy: [{ availability: 'asc' }, { order: 'asc' }],
      select: { titleFr: true },
      take: PER_AGENT,
    })
    .catch(() => []);

  return documents.map((document) => phrases.whereIsDoc(shorten(document.titleFr)));
}

async function onboardingSuggestions(user, phrases) {
  if (!canAnyScope(user, 'read', 'onboarding_task')) return [];

  const journey = await loadJourney(user).catch(() => null);
  if (!journey || journey.tasks.length === 0) return [];

  const questions = [];
  const pending = journey.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'VALIDATED');

  if (pending.length > 0) questions.push(phrases.journeyRemaining);
  if (journey.tasks.some((task) => task.overdue)) questions.push(phrases.journeyOverdue);
  if (pending[0]) questions.push(phrases.journeyTask(shorten(pending[0].titleFr)));

  return questions.slice(0, PER_AGENT);
}

async function trainingSuggestions(user, phrases) {
  if (!canAnyScope(user, 'read', 'training')) return [];

  const catalogue = await loadCatalogue(user).catch(() => null);
  if (!catalogue || catalogue.entries.length === 0) return [];

  const questions = [];
  const mandatory = catalogue.entries.filter((entry) => entry.isMandatory);

  if (mandatory.length > 0) questions.push(phrases.mandatoryModules);
  if (mandatory[0]) {
    questions.push(phrases.passingScore(shorten(mandatory[0].titleFr)));
  }
  if (catalogue.entries.some((entry) => entry.best)) {
    questions.push(phrases.myTrainingProgress);
  } else if (catalogue.entries[1]) {
    questions.push(phrases.whatIsModule(shorten(catalogue.entries[1].titleFr)));
  }

  return questions.slice(0, PER_AGENT);
}

async function competencySuggestions(user, phrases) {
  if (!canAnyScope(user, 'read', 'competency')) return [];

  /*
   * Asked through the repository rather than listPositionsWithMatrix(): this needs the
   * *names* of positions that carry competency rows, which is one query, where the matrix
   * loader is several and returns far more than a chip label needs.
   */
  const withCompetencies = await prisma.jobCompetency
    .findMany({
      distinct: ['positionId'],
      select: { position: { select: { titleFr: true } } },
      take: PER_AGENT,
    })
    .catch(() => []);

  const questions = withCompetencies
    .map((row) => row.position?.titleFr)
    .filter(Boolean)
    .map((title) => phrases.skillsForPost(shorten(title)));

  if (questions.length > 0) questions.push(phrases.mySkillGaps);
  return questions.slice(0, PER_AGENT);
}

const BUILDERS = {
  orientation: orientationSuggestions,
  documents: documentSuggestions,
  onboarding: onboardingSuggestions,
  training: trainingSuggestions,
  competencies: competencySuggestions,
};

/**
 * Suggestions for every agent, as `{ [agentId]: string[] }`, phrased in `lang`.
 *
 * Built concurrently and defensively: one agent's loader failing costs that agent its chips,
 * not the whole panel. An agent with nothing to suggest is simply absent from the map.
 */
export async function buildSuggestions(user, lang) {
  const phrases = PHRASES[resolveLanguage(lang)];

  const entries = await Promise.all(
    Object.entries(BUILDERS).map(async ([agentId, build]) => {
      const questions = await build(user, phrases).catch(() => []);
      return [agentId, questions];
    }),
  );

  return Object.fromEntries(entries.filter(([, questions]) => questions.length > 0));
}
