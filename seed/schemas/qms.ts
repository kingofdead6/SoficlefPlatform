import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** A process of the ISO 9001 process map, code ID-03-DG — prototype page "smq". */
export const QmsProcess = z.object({
  code: z.string().regex(/^P[MRS]\d{2}$/),
  category: z.enum(['MANAGEMENT', 'REALISATION', 'SUPPORT']),
  categoryLabelFr: NonEmpty,
  nameFr: NonEmpty,
  isOwnedByProductionDirector: z.boolean(),
});

export const Qms = z.object({
  standardFr: NonEmpty,
  certificationBodyFr: NonEmpty,
  certifiedSinceFr: NonEmpty,
  certificationScopeFr: NonEmpty,
  ownedProcessCode: z.literal('PR02'),
  ownedProcessNoteFr: NonEmpty,
  processMapCode: z.literal('ID-03-DG'),
  responsibilities: z.array(z.object({ id: Id, textFr: NonEmpty })),
  processes: z.array(QmsProcess),
});

export const QmsFile = seedFile(Qms);
export type QmsT = z.infer<typeof Qms>;
