/**
 * The language an assistant answer is written in, and the connective words the retrievers
 * use to build it.
 *
 * Two different things are translated here, and they should not be confused:
 *
 *   1. **The phrasing the platform adds.** "échéance", "module obligatoire", "poste vacant" —
 *      words this code writes around the data. Those are what the tables below hold, in all
 *      three languages, because a French skeleton around English content reads worse than
 *      either language alone.
 *   2. **The content itself.** A task's title, a document's name, a competency's label. Those
 *      come from `<field>Fr` columns and are *not* translated here — inventing a translation
 *      for a document called "Procédure d'accueil PR-RH-01" would make it unfindable in the
 *      library it points at. They render as stored, in every language.
 *
 * So an Arabic answer reads as Arabic sentences citing French document names, which is what
 * a bilingual workplace actually sounds like — and, when a model is configured, what it is
 * handed as context and asked to write from.
 *
 * Domain-ish: no database, no I/O, no framework.
 */

/** The languages the assistant answers in — the same three the UI offers. */
export const ASSISTANT_LANGUAGES = ['fr', 'en', 'ar'];

export const DEFAULT_LANGUAGE = 'fr';

/**
 * Narrow whatever the client sent to one of the three supported languages.
 *
 * Tolerant on purpose: a caller may send `en-GB`, `AR`, nothing at all, or a language the
 * platform does not have. None of those is worth failing a question over, so anything
 * unrecognised falls back to French rather than throwing — the assistant answering in the
 * wrong language is a far smaller failure than it not answering.
 */
export function assistantLanguage(value) {
  const prefix = String(value ?? '')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return ASSISTANT_LANGUAGES.includes(prefix) ? prefix : DEFAULT_LANGUAGE;
}

/**
 * The BCP-47 tag for dates inside an answer.
 *
 * Deliberately identical to the client's `localeOf` (Client/src/lib/formatDate.js): en-GB so
 * English dates stay D/M/Y like the French ones, ar-DZ so Arabic ones keep D/M/Y *and* Latin
 * digits. A date the assistant reads out must match the date the same user sees on the page
 * it links to, or the citation looks wrong.
 */
export function localeTag(language) {
  if (language === 'en') return 'en-GB';
  if (language === 'ar') return 'ar-DZ';
  return 'fr-FR';
}

/** A date as the reader's own pages render it, or null when there isn't one. */
export function formatDate(value, language) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(localeTag(language));
}

const FR = {
  // orientation
  vacantPost: 'poste vacant',
  extension: (value) => `poste ${value}`,
  // documents
  documentAvailable: 'document disponible',
  awaitingPublication: 'en attente de publication',
  noDetail: 'aucun détail renseigné',
  // onboarding
  taskStatus: {
    TODO: 'à faire',
    IN_PROGRESS: 'en cours',
    DONE: 'terminée',
    BLOCKED: 'bloquée',
    VALIDATED: 'validée',
  },
  due: (value) => `échéance ${value}`,
  overdue: 'en retard',
  dueSoon: 'bientôt',
  phase: (value) => `phase ${value}`,
  // training
  mandatoryModule: 'module obligatoire',
  optionalModule: 'module facultatif',
  mandatoryKeyword: 'obligatoire',
  optionalKeyword: 'facultatif',
  passingScore: (value) => `seuil de réussite ${value} %`,
  bestScore: (score, passed) =>
    `votre meilleur score : ${score} % — ${passed ? 'validé' : 'non validé'}`,
  noAttempt: 'aucune tentative de votre part',
  // competencies
  gapStatus: {
    conforme: 'conforme',
    'a-developper': 'à développer',
    critique: 'écart critique',
    'non-evalue': 'non évaluée',
  },
  requiredLevel: (level, max) => `niveau requis ${level}/${max}`,
  mandatoryCompetency: 'compétence obligatoire',
  optionalCompetency: 'compétence optionnelle',
  state: (value) => `état : ${value}`,
  family: (value) => `famille ${value}`,
};

const EN = {
  vacantPost: 'vacant post',
  extension: (value) => `ext. ${value}`,
  documentAvailable: 'document available',
  awaitingPublication: 'awaiting publication',
  noDetail: 'no detail recorded',
  taskStatus: {
    TODO: 'to do',
    IN_PROGRESS: 'in progress',
    DONE: 'completed',
    BLOCKED: 'blocked',
    VALIDATED: 'validated',
  },
  due: (value) => `due ${value}`,
  overdue: 'overdue',
  dueSoon: 'due soon',
  phase: (value) => `phase ${value}`,
  mandatoryModule: 'mandatory module',
  optionalModule: 'optional module',
  mandatoryKeyword: 'mandatory',
  optionalKeyword: 'optional',
  passingScore: (value) => `pass mark ${value}%`,
  bestScore: (score, passed) => `your best score: ${score}% — ${passed ? 'passed' : 'not passed'}`,
  noAttempt: 'no attempt from you yet',
  gapStatus: {
    conforme: 'meets the requirement',
    'a-developper': 'to develop',
    critique: 'critical gap',
    'non-evalue': 'not assessed',
  },
  requiredLevel: (level, max) => `required level ${level}/${max}`,
  mandatoryCompetency: 'mandatory competency',
  optionalCompetency: 'optional competency',
  state: (value) => `state: ${value}`,
  family: (value) => `family ${value}`,
};

const AR = {
  vacantPost: 'منصب شاغر',
  extension: (value) => `الرقم الداخلي ${value}`,
  documentAvailable: 'الوثيقة متاحة',
  awaitingPublication: 'في انتظار النشر',
  noDetail: 'لا توجد تفاصيل مسجلة',
  taskStatus: {
    TODO: 'قيد الإنجاز',
    IN_PROGRESS: 'جارية',
    DONE: 'منتهية',
    BLOCKED: 'متوقفة',
    VALIDATED: 'مصادق عليها',
  },
  due: (value) => `الأجل ${value}`,
  overdue: 'متأخرة',
  dueSoon: 'قريبة الأجل',
  phase: (value) => `المرحلة ${value}`,
  mandatoryModule: 'وحدة إجبارية',
  optionalModule: 'وحدة اختيارية',
  mandatoryKeyword: 'إجبارية',
  optionalKeyword: 'اختيارية',
  passingScore: (value) => `عتبة النجاح ${value} %`,
  bestScore: (score, passed) =>
    `أفضل نتيجة لك: ${score} % — ${passed ? 'ناجح' : 'غير ناجح'}`,
  noAttempt: 'لا توجد محاولة من طرفك',
  gapStatus: {
    conforme: 'مطابق',
    'a-developper': 'يحتاج إلى تطوير',
    critique: 'فارق حرج',
    'non-evalue': 'غير مقيَّمة',
  },
  requiredLevel: (level, max) => `المستوى المطلوب ${level}/${max}`,
  mandatoryCompetency: 'كفاءة إجبارية',
  optionalCompetency: 'كفاءة اختيارية',
  state: (value) => `الحالة: ${value}`,
  family: (value) => `العائلة ${value}`,
};

const VOCABULARY = { fr: FR, en: EN, ar: AR };

/** The connective vocabulary for one language. Unknown input resolves to French. */
export function vocabulary(language) {
  return VOCABULARY[assistantLanguage(language)];
}

/**
 * The same vocabulary entry in all three languages, joined into one searchable string.
 *
 * Used for *matching*, never for display. A reader on the Arabic interface still types "en
 * retard" or "overdue" as often as they type "متأخرة" — the words on a printed checklist and
 * the words a colleague used in a message do not switch with the UI. Scoring a task against
 * only the active language's status word would drop those questions entirely, and the reader
 * would read that as the assistant not knowing about their task.
 *
 *   everyLanguage((words) => words.taskStatus.BLOCKED)  ->  "bloquée blocked متوقفة"
 */
export function everyLanguage(pick) {
  return ASSISTANT_LANGUAGES.map((language) => pick(VOCABULARY[language]))
    .filter((value) => typeof value === 'string' && value)
    .join(' ');
}

/**
 * The separator between the parts of one retrieved row.
 *
 * Arabic gets the Arabic comma rather than the middle dot the Latin scripts use: the dot
 * reads as a decimal point or a bullet in an RTL line, where "،" is the character a reader
 * actually expects between clauses.
 */
export function partSeparator(language) {
  return assistantLanguage(language) === 'ar' ? '، ' : ' · ';
}
