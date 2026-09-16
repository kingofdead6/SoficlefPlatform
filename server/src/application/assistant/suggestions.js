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
 * The questions are phrased in French because the retrievers match against French rows. The
 * *answer* follows the language of the question (see answer.js) — a reader can equally type
 * their own question in English or Arabic.
 */

/** How many chips one agent is worth. More than three reads as a menu, not as a hint. */
const PER_AGENT = 3;

/** Trims a label so a chip stays a chip: long titles are cut on a word boundary. */
function shorten(value, max = 48) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

async function orientationSuggestions(user) {
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
    questions.push(`Qui occupe le poste de ${shorten(node.titleFr)} ?`);
    if (questions.length >= 2) break;
  }

  for (const contact of contacts) {
    if (questions.length >= PER_AGENT) break;
    questions.push(`À qui m'adresser pour ${shorten(contact.roleFr)} ?`);
  }

  return questions.slice(0, PER_AGENT);
}

async function documentSuggestions(user) {
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

  return documents.map((document) => `Où trouver « ${shorten(document.titleFr)} » ?`);
}

async function onboardingSuggestions(user) {
  if (!canAnyScope(user, 'read', 'onboarding_task')) return [];

  const journey = await loadJourney(user).catch(() => null);
  if (!journey || journey.tasks.length === 0) return [];

  const questions = [];
  const pending = journey.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'VALIDATED');

  if (pending.length > 0) questions.push('Que me reste-t-il à faire dans mon parcours ?');
  if (journey.tasks.some((task) => task.overdue)) questions.push('Qu’est-ce qui est en retard ?');
  if (pending[0]) questions.push(`Où en est « ${shorten(pending[0].titleFr)} » ?`);

  return questions.slice(0, PER_AGENT);
}

async function trainingSuggestions(user) {
  if (!canAnyScope(user, 'read', 'training')) return [];

  const catalogue = await loadCatalogue(user).catch(() => null);
  if (!catalogue || catalogue.entries.length === 0) return [];

  const questions = [];
  const mandatory = catalogue.entries.filter((entry) => entry.isMandatory);

  if (mandatory.length > 0) questions.push('Quels modules de formation sont obligatoires ?');
  if (mandatory[0]) {
    questions.push(`Quel est le seuil de réussite de « ${shorten(mandatory[0].titleFr)} » ?`);
  }
  if (catalogue.entries.some((entry) => entry.best)) {
    questions.push('Où en suis-je dans mes formations ?');
  } else if (catalogue.entries[1]) {
    questions.push(`En quoi consiste « ${shorten(catalogue.entries[1].titleFr)} » ?`);
  }

  return questions.slice(0, PER_AGENT);
}

async function competencySuggestions(user) {
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
    .map((title) => `Quelles compétences demande le poste de ${shorten(title)} ?`);

  if (questions.length > 0) questions.push('Quels sont mes écarts de compétences ?');
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
 * Suggestions for every agent, as `{ [agentId]: string[] }`.
 *
 * Built concurrently and defensively: one agent's loader failing costs that agent its chips,
 * not the whole panel. An agent with nothing to suggest is simply absent from the map.
 */
export async function buildSuggestions(user) {
  const entries = await Promise.all(
    Object.entries(BUILDERS).map(async ([agentId, build]) => {
      const questions = await build(user).catch(() => []);
      return [agentId, questions];
    }),
  );

  return Object.fromEntries(entries.filter(([, questions]) => questions.length > 0));
}
