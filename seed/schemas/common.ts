import { z } from 'zod';

/**
 * Shared primitives for every seed schema.
 *
 * Rules that apply to all extracted data (ADR-027):
 *  - French text is preserved verbatim; nothing is corrected, rephrased or translated.
 *  - Arabic and English values are absent until the client supplies reviewed
 *    translations (ADR-025). They are never machine-translated.
 *  - Every record carries a stable identifier: the business code where one exists
 *    (EN-012-DRH, PS-01, PR02, a phone extension), a deterministic slug otherwise.
 */

/** Non-empty text, trimmed. Empty strings are an extraction failure, not a value. */
export const NonEmpty = z.string().trim().min(1);

/**
 * A stable identifier. Business codes keep their own casing (EN-012-DRH, PR02);
 * derived identifiers are lower-kebab slugs (structure-fabrication).
 */
export const Id = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'identifier must be code- or slug-shaped');

/** Source page of the prototype a record was read from, for traceability. */
export const SourcePage = z.enum([
  'bienvenue',
  'entreprise',
  'strategie',
  'poste',
  'structures',
  'encadrement',
  'recrutements',
  'kaizen',
  'smq',
  'hse',
  'checklist',
  'interlocuteurs',
  'bilan',
  'remarques',
  'docs',
]);

/**
 * A translatable label. `fr` is always present and verbatim from the prototype;
 * `ar` / `en` stay null until the client supplies a reviewed translation (ADR-025).
 */
export const I18nText = z.object({
  fr: NonEmpty,
  ar: z.string().trim().min(1).nullable(),
  en: z.string().trim().min(1).nullable(),
});

/** Every seed file carries provenance so a re-run is auditable. */
export const SeedMeta = z.object({
  domain: NonEmpty,
  sourceFile: NonEmpty,
  sourcePages: z.array(SourcePage).min(1),
  extractedCount: z.number().int().nonnegative(),
});

export type I18nTextT = z.infer<typeof I18nText>;
export type SeedMetaT = z.infer<typeof SeedMeta>;

/** Wraps a domain payload with its provenance envelope. */
export function seedFile<T extends z.ZodTypeAny>(payload: T) {
  return z.object({ meta: SeedMeta, data: payload });
}
