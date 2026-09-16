/**
 * The term extraction and scoring shared by all five assistant retrievers.
 *
 * Extracted from orientation.js when the four other agents were implemented: five copies of
 * a ranking function would have meant five subtly different answers to the same question,
 * and a fix applied to one of them.
 *
 * Domain-ish helpers: no database, no I/O, no framework.
 */

/**
 * Words carrying no signal; dropped before matching so "le responsable" ranks on "responsable".
 *
 * Two groups. The first is ordinary grammar — articles, pronouns, question words.
 *
 * The second is vocabulary that is *common to the corpus itself*, and it is what makes the
 * general-knowledge path reachable. Every entry here mentions a « méthode », a « plan », a
 * « période » or how something « fonctionne », so a question containing one of those words
 * matched something no matter what it was actually asking: "explain lean manufacturing" landed
 * on Direction Production, "comment fonctionne la retraite en Algérie" on the paragraph
 * describing the assistant. The match was real but it was not an answer, and because the
 * pipeline treats any match as grounding, the model was handed irrelevant context and replied
 * that it could not find the answer there — instead of simply answering from general
 * knowledge, which it could have done well.
 *
 * These words still contribute when they appear *alongside* a specific term: dropping them
 * costs "plan de circulation" nothing, because « circulation » carries it.
 */
const STOP_WORDS = new Set([
  // grammar
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'à', 'au', 'aux', 'et', 'ou',
  'qui', 'que', 'quoi', 'est', 'pour', 'dans', 'sur', 'avec', 'mon', 'ma', 'mes', 'je',
  'dois', 'faut', 'il', 'elle', 'contacter', 'parler', 'demander', 'voir', 'sais', 'pas',
  'the', 'who', 'what', 'is', 'for', 'to', 'my', 'i', 'should', 'about', 'do',
  'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'cette', 'ce',
  'son', 'sa', 'ses', 'leur', 'nous', 'vous', 'par', 'en', 'sont', 'etre', 'avoir',
  'how', 'why', 'when', 'where', 'which', 'are', 'can', 'does', 'explain', 'tell', 'me',
  'general', 'generale', 'generales', 'generaux',

  // corpus-common: true of almost every row, so decisive of none
  'methode', 'methodes', 'plan', 'plans', 'periode', 'periodes', 'fonctionne',
  'fonctionnement', 'gestion', 'systeme', 'systemes', 'service', 'services',
  'entreprise', 'societe', 'travail', 'interne', 'internes',
  'method', 'methods', 'period', 'management', 'company', 'work', 'process',
]);

/**
 * Normalises for comparison: lowercase, accents stripped, punctuation gone.
 *
 * Accent-stripping is not cosmetic here — "compétences" and "competences" must match, and
 * users type both.
 *
 * What is kept is "any letter or digit, in any script" rather than `a-z0-9`. The earlier
 * class silently deleted every Arabic character, so an Arabic question normalised to the
 * empty string, produced no terms, and every retriever returned nothing before the model was
 * ever reached — the assistant appeared to have no Arabic support when in fact the question
 * never survived this function.
 *
 * Only *Latin* combining marks are stripped (U+0300–U+036F). A blanket `\p{Diacritic}` also
 * matches the hamza carried by Arabic letters such as ؤ, which decomposes and then loses its
 * mark — splitting المسؤول into two fragments that match nothing. Arabic marks are part of
 * the letter, not decoration on it.
 */
export function normalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // `\p{M}` is kept alongside letters and digits: after NFD an Arabic hamza is a combining
    // mark, and dropping it here would break المسؤول into two fragments that match nothing.
    // The Latin marks that would otherwise survive were already removed above.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The minimum term length is 3 for Latin script but 2 otherwise: Arabic words are short and
 * dense — "من" (who), "ما" (what) are two characters and a three-character floor would drop
 * most of a short question. Latin keeps its floor so "de"/"la" style noise stays out.
 */
function longEnough(word) {
  if (word.length > 2) return true;
  return word.length === 2 && !/^[a-z0-9]+$/.test(word);
}

export function terms(question) {
  return normalise(question)
    .split(' ')
    .filter((word) => longEnough(word) && !STOP_WORDS.has(word));
}

/**
 * How well a candidate matches the question.
 *
 * Whole-word matches score above substring ones, so "RH" does not win on "acheteur"
 * containing the letters. A candidate matching nothing scores zero and is dropped rather
 * than shown as a weak guess.
 */
export function score(haystack, questionTerms) {
  const flat = normalise(haystack);
  const words = new Set(flat.split(' '));
  let total = 0;
  for (const term of questionTerms) {
    if (words.has(term)) total += 3;
    else if (flat.includes(term)) total += 1;
  }
  return total;
}

/**
 * Is this score good enough to call the question *answered* by this row?
 *
 * Any match above zero used to count, and that quietly disabled the general-knowledge path:
 * "c'est quoi la méthode 5S ?" matched the Production entry on its incidental words and
 * "what is a probation period" matched two unrelated documents, so the pipeline believed it
 * had grounding, handed the model irrelevant context, and the model dutifully replied that it
 * could not find the answer there. A confident "not in the context" is a worse answer than an
 * honest general one.
 *
 * The floor is relative, not absolute, because question length varies: what matters is how
 * much *of the question* the candidate accounts for. One whole word out of five is noise; one
 * out of two ("règlement intérieur") is the question itself.
 *
 * A candidate must cover `MIN_COVERAGE` of the question's maximum possible score. The share
 * is what does the work, and it is why "one whole-word match is always enough" was tried and
 * rejected: « plan » alone then grounded "explain lean manufacturing" on the maintenance plan,
 * and « general » grounded a probation question on the general org chart. A long question with
 * one incidental hit is exactly the case this floor exists to catch.
 *
 * 0.3 rather than a third, so that a single strong noun still carries a three-term question:
 * "Qui s'occupe de la direction finances ?" keeps three terms, of which only « finances »
 * matches the post — 3 of a possible 9. That is the shortest question where one match should
 * still win, and the six-term noise cases sit well below it.
 *
 * Substring-only matches score 1 per term and so can essentially never clear the bar, which
 * is the intent: containing the letters is not matching the word.
 */
const WEIGHT_WHOLE_WORD = 3;
const MIN_COVERAGE = 0.3;

export function isRelevant(candidateScore, questionTerms) {
  if (candidateScore <= 0) return false;
  const maximum = questionTerms.length * WEIGHT_WHOLE_WORD;
  if (maximum === 0) return false;
  return candidateScore / maximum >= MIN_COVERAGE;
}

/**
 * Keeps only what is nearly as good as the best match.
 *
 * Without this, "responsable HSE" answered correctly and then padded the answer with every
 * other "Responsable" that scored on that one shared word. Three results are not better than
 * one when two of them are wrong: the extras read as alternatives, and the reader has no way
 * to tell which is which.
 *
 * Pass `questionTerms` to also apply the relevance floor (see `isRelevant`): the best of a
 * bad field is still a bad match, and returning it tells the pipeline it has grounding when
 * it does not. The parameter is optional so a caller that has already filtered can skip it.
 */
export function topMatches(candidates, limit = 3, questionTerms = null) {
  if (candidates.length === 0) return [];

  /*
   * `relevanceScore` lets a caller separate the two jobs a score does. Ranking may be boosted
   * (the knowledge retriever weights curated keywords 4× so they outrank prose), but the
   * floor has to be judged on an unboosted score or the boost simply lifts everything over
   * the bar. Callers that do not boost omit it and the ranking score is used for both.
   */
  const eligible = questionTerms
    ? candidates.filter((candidate) =>
        isRelevant(candidate.relevanceScore ?? candidate.score, questionTerms),
      )
    : candidates;
  if (eligible.length === 0) return [];

  const sorted = [...eligible].sort((a, b) => b.score - a.score);
  const best = sorted[0].score;
  return sorted.filter((candidate) => candidate.score >= best).slice(0, limit);
}
