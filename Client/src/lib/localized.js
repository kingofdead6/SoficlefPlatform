import { useTranslation } from 'react-i18next';

/**
 * Reading database content in the reader's language.
 *
 * The catalogues under src/i18n cover text the *application* owns — labels, headings, CTAs.
 * They cannot cover the text the *company* owns: its mission, each trade, each market, each
 * unit's description. That lives in the database, where every translatable column is stored
 * as a trio — `<field>Fr`, `<field>Ar`, `<field>En` — with only the French one guaranteed to
 * be filled.
 *
 * So there are two rules, and they are the whole module:
 *
 *   1. Ask for the active language's column first.
 *   2. Fall back to French when it is missing, null, or blank.
 *
 * Rule 2 is what makes translating incremental: a row becomes trilingual the moment someone
 * fills its columns in, and until then it renders the French text rather than a blank
 * paragraph — which is the failure a plain `record[field + suffix]` would produce, and the
 * one a visitor would notice.
 */

/** Language code -> the column suffix that holds it. */
const SUFFIX = { fr: 'Fr', ar: 'Ar', en: 'En' };

/**
 * `record.<base><Suffix>` for `language`, falling back to the French column.
 *
 * Exported as a plain function (not only as the hook below) so non-component code —
 * sorting, filtering, building an export — can resolve the same value the page shows.
 */
export function localizedField(record, base, language) {
  if (!record) return '';

  const suffix = SUFFIX[language] ?? SUFFIX.fr;
  const translated = record[`${base}${suffix}`];

  // A whitespace-only translation is not one: it would render as an empty line where the
  // French text belongs, which reads as a bug rather than as a missing translation.
  if (typeof translated === 'string' && translated.trim()) return translated;

  const french = record[`${base}${SUFFIX.fr}`];
  return typeof french === 'string' ? french : (french ?? '');
}

/**
 * The component-facing form: `const text = useLocalizedField();` then `text(unit, 'name')`.
 *
 * It goes through `useTranslation` rather than reading `i18n.language` directly so the
 * component re-renders on a language switch — the same reason every label on these pages
 * comes from `t()`. Without that subscription a page would keep the language it first
 * rendered in until something else happened to re-render it.
 */
export function useLocalizedField() {
  const { i18n } = useTranslation();
  return (record, base) => localizedField(record, base, i18n.language);
}
