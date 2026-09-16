/**
 * The term extraction and scoring shared by all five assistant retrievers.
 *
 * Extracted from orientation.js when the four other agents were implemented: five copies of
 * a ranking function would have meant five subtly different answers to the same question,
 * and a fix applied to one of them.
 *
 * Domain-ish helpers: no database, no I/O, no framework.
 */

/** Words carrying no signal; dropped before matching so "le responsable" ranks on "responsable". */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'à', 'au', 'aux', 'et', 'ou',
  'qui', 'que', 'quoi', 'est', 'pour', 'dans', 'sur', 'avec', 'mon', 'ma', 'mes', 'je',
  'dois', 'faut', 'il', 'elle', 'contacter', 'parler', 'demander', 'voir', 'sais', 'pas',
  'the', 'who', 'what', 'is', 'for', 'to', 'my', 'i', 'should', 'about', 'do',
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
 * Keeps only what is nearly as good as the best match.
 *
 * Without this, "responsable HSE" answered correctly and then padded the answer with every
 * other "Responsable" that scored on that one shared word. Three results are not better than
 * one when two of them are wrong: the extras read as alternatives, and the reader has no way
 * to tell which is which.
 */
export function topMatches(candidates, limit = 3) {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0].score;
  return sorted.filter((candidate) => candidate.score >= best).slice(0, limit);
}
