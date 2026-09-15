import { SYNONYM_GROUPS } from './synonyms.js';

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
 * Words carrying no signal; dropped before matching so "le responsable" ranks on
 * "responsable".
 *
 * All three languages in one set rather than one set per language, because the set is
 * consulted *after* a question has been normalised and the question's language is not known
 * at that point — and does not need to be: these words collide with nothing meaningful in
 * the other two. Someone typing a French question with an English word in it gets both
 * handled, which is what actually happens in this workplace.
 */
const STOP_WORDS = new Set([
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'à', 'au', 'aux', 'et', 'ou',
  'qui', 'que', 'quoi', 'est', 'pour', 'dans', 'sur', 'avec', 'mon', 'ma', 'mes', 'je',
  'dois', 'faut', 'il', 'elle', 'contacter', 'parler', 'demander', 'voir', 'sais', 'pas',
  'ce', 'cette', 'quel', 'quelle', 'comment', 'ou', 'son', 'sa', 'ses', 'nous', 'vous',
  // English
  'the', 'who', 'what', 'is', 'for', 'to', 'my', 'i', 'should', 'about', 'do', 'does',
  'are', 'and', 'or', 'in', 'on', 'with', 'how', 'where', 'which', 'can', 'need', 'want',
  'me', 'our', 'your', 'have', 'has', 'talk', 'ask', 'contact', 'see', 'find', 'know',
  /*
   * Arabic — the interrogatives and prepositions that open most questions.
   *
   * Written in their *normalised* form, which is what `terms()` compares against: أين is
   * listed as اين and إلى as الي, because the folding above has already flattened the hamza
   * and the alif maqsura by the time the set is consulted. A word listed in its written form
   * would never match and would quietly stop being a stop word.
   */
  'من', 'ما', 'ماذا', 'هل', 'اين', 'كيف', 'متي', 'لماذا', 'الي', 'علي',
  'في', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'هو', 'هي', 'انا', 'يجب',
]);

/**
 * Arabic letters, including the Arabic Supplement and Extended-A blocks.
 *
 * Kept as its own constant because it appears in three places below and getting one of them
 * wrong would silently drop Arabic from matching — which is exactly the bug this range was
 * added to fix: the previous `[^a-z0-9\s]` filter erased every Arabic character, so an
 * Arabic question produced zero terms and every agent answered "nothing found", in every
 * case, for every question. A search that cannot represent a language cannot search in it.
 */
const ARABIC = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF';

const NON_SEARCHABLE = new RegExp(`[^a-z0-9${ARABIC}\\s]`, 'g');
const HAS_ARABIC = new RegExp(`[${ARABIC}]`);

/**
 * Arabic punctuation, stripped explicitly.
 *
 * It sits *inside* the letter range above — "؟" is U+061F, between two blocks of letters —
 * so the `[^a-z0-9…]` filter that removes "?" and "," leaves their Arabic counterparts
 * attached to the word before them. The symptom is subtle and total: every Arabic question
 * ends in a term like "التكوين؟" that matches no stored value, so the last and usually most
 * specific word of the question is the one that never scores.
 */
const ARABIC_PUNCTUATION = /[\u0600-\u0605\u060C-\u061F\u066A-\u066D\u06D4]/g;

/** Arabic-Indic digits, folded onto the Latin ones the database stores. */
const ARABIC_DIGITS = /[\u0660-\u0669]/g;

/**
 * The definite article "ال", removed from the front of a word that keeps at least three
 * letters without it.
 *
 * Arabic attaches its article to the noun, so "الوثيقة" (the document) and "وثيقة"
 * (document) are the same word written two ways, and a reader asking about "الوثيقة" would
 * otherwise miss every row storing "وثيقة". Applied to the question and the stored text
 * alike — it is a normalisation, not a query rewrite, so both sides always agree.
 */
const ARABIC_ARTICLE = /(^|\s)ال(?=[\u0620-\u064A]{3,})/g;

/**
 * Arabic diacritics (harakat), the hamza and madda marks, and the tatweel elongation
 * character.
 *
 * Stripped for the same reason French accents are: they are optional in writing, so the same
 * word reaches us spelled both ways and the two must match.
 *
 * The range runs to U+0655 rather than stopping at the harakat because `normalize('NFD')`
 * above decomposes أ, إ and آ into a bare ا followed by a *combining* hamza or madda — which
 * the Latin combining-mark range does not cover and the composed `[أإآٱ]` replacement below
 * can no longer see. Without these three code points the folding silently does nothing for
 * every word that begins with a hamzated alif, which in Arabic is most of the interrogatives.
 */
const ARABIC_MARKS = /[\u064B-\u0655\u0670\u0640]/g;

/**
 * Normalises for comparison: lowercase, accents stripped, punctuation gone, Arabic folded.
 *
 * Accent-stripping is not cosmetic here — "compétences" and "competences" must match, and
 * users type both. The Arabic folding below is the same idea applied to a different script:
 * أ/إ/آ all become ا and ة becomes ه, because those distinctions are routinely dropped when
 * typing and a reader who drops one should still find their answer.
 */
export function normalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    // Combining marks from the Latin decomposition above. Arabic marks are handled next;
    // they are not produced by NFD and would survive this.
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(ARABIC_PUNCTUATION, ' ')
    .replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(NON_SEARCHABLE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Last, so it sees whitespace-separated words rather than punctuation-glued ones.
    .replace(ARABIC_ARTICLE, '$1');
}

/**
 * The shortest word worth matching on.
 *
 * Three characters for Latin script, two for Arabic. Not a rounding error: Arabic writes
 * short vowels as diacritics rather than letters, so meaningful words routinely have two
 * letters where their French equivalent has five — "قسم" (department) survives either
 * threshold, but "أجر" (pay) and "دور" (role) are three, and folding can take a word to two.
 * Applying the Latin threshold to Arabic would quietly discard real search terms.
 */
function isSearchable(word) {
  return HAS_ARABIC.test(word) ? word.length > 1 : word.length > 2;
}

/**
 * word -> every normalised spelling of the concept it belongs to.
 *
 * Built once at module load from `SYNONYM_GROUPS`, normalised on the way in so the index is
 * keyed exactly the way a normalised question word will arrive. A word appearing in two
 * groups keeps the first — an ambiguity to resolve in the table, not silently at lookup time.
 *
 * Multi-word entries ("الموارد البشرية", "entretien technique") are indexed under each of
 * their words as well as being searched whole: the question is split on spaces before it gets
 * here, so an entry only reachable as a phrase would never be found.
 */
const SYNONYM_INDEX = (() => {
  const index = new Map();

  for (const group of SYNONYM_GROUPS) {
    const variants = [...new Set(group.map((entry) => normalise(entry)).filter(Boolean))];

    for (const variant of variants) {
      for (const word of variant.split(' ')) {
        if (!index.has(word)) index.set(word, variants);
      }
    }
  }

  return index;
})();

/**
 * The question's search terms, each expanded to every language it could be written in.
 *
 * Returns a group per word — `['training', 'formation', 'تكوين']` — rather than a bare word,
 * because the content being searched is stored in one language whatever language the question
 * is asked in. Without this, two of the three interfaces have an assistant that answers
 * "nothing found" to questions it holds the answer to.
 *
 * A word in no group becomes a group of one, so nothing is lost by not being in the table.
 */
export function terms(question) {
  return normalise(question)
    .split(' ')
    .filter((word) => isSearchable(word) && !STOP_WORDS.has(word))
    .map((word) => SYNONYM_INDEX.get(word) ?? [word]);
}

/**
 * How well a candidate matches the question.
 *
 * Whole-word matches score above substring ones, so "RH" does not win on "acheteur"
 * containing the letters. A candidate matching nothing scores zero and is dropped rather
 * than shown as a weak guess.
 *
 * Each entry of `questionTerms` is a group of synonyms scored *once*, at its best match:
 * a row saying "Responsable Formation" answers "training" exactly as well as it answers
 * "formation", and no better for saying both. Counting each variant separately would rank a
 * row by how many languages happen to name the same concept in it.
 */
export function score(haystack, questionTerms) {
  const flat = normalise(haystack);
  const words = new Set(flat.split(' '));
  let total = 0;

  for (const term of questionTerms) {
    // A plain string is still accepted, so a caller holding one term does not have to wrap it.
    const variants = Array.isArray(term) ? term : [term];

    if (variants.some((variant) => words.has(variant))) total += 3;
    else if (variants.some((variant) => flat.includes(variant))) total += 1;
  }

  return total;
}

/**
 * How close to the best match a candidate must be to be shown alongside it.
 *
 * The rule this implements: three results are not better than one when two of them are
 * wrong, because the extras read as alternatives and the reader has no way to tell which is
 * which. Without a threshold, "responsable HSE" answered correctly and then padded the
 * answer with every other "Responsable" that scored on that one shared word.
 *
 * But requiring an exact tie with the best score — which is what this did before — is the
 * same mistake in the other direction: a row matching "congé" and "annuel" where the best
 * matched "congé", "annuel" and "solde" is a genuine second answer, and dropping it leaves
 * the reader with one result and no idea another existed. Two thirds is where "as good as
 * the best" stops and "matched one word out of three" begins.
 */
const RELATIVE_THRESHOLD = 2 / 3;

export function topMatches(candidates, limit = 3) {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0].score;
  return sorted
    .filter((candidate) => candidate.score >= best * RELATIVE_THRESHOLD)
    .slice(0, limit);
}
