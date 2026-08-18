import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * The four pillars of the Charte de Management — prototype page "entreprise".
 *
 * The Arabic strings are taken from the prototype, which is the good copy: the same
 * strings are corrupted in CDC v1's PDF by a font-encoding fault (ADR-026, OQ-21).
 * They are preserved byte for byte and must be confirmed by the client.
 * `nameEn` comes from CDC v1 §1.2, which is a client document, not a translation of ours.
 */
export const CompanyValue = z.object({
  id: Id,
  rank: z.number().int().min(1).max(99),
  nameFr: NonEmpty,
  nameAr: z.string().trim().regex(/[؀-ۿ]/, 'expected Arabic script'),
  nameEn: NonEmpty.nullable(),
});

export const ValuesFile = seedFile(z.array(CompanyValue));
export type CompanyValueT = z.infer<typeof CompanyValue>;
