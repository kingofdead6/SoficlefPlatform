import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** A reference PDF offered by the prototype — prototype page "docs". */
export const ReferenceDocument = z.object({
  id: Id,
  fileName: NonEmpty,
  titleFr: NonEmpty,
  detailFr: NonEmpty,
  availability: z.literal('AVAILABLE'),
});

/** A document the business still has to supply. */
export const PendingDocument = z.object({
  id: Id,
  titleFr: NonEmpty,
  availability: z.literal('PENDING'),
});

export const Documents = z.object({
  available: z.array(ReferenceDocument),
  pending: z.array(PendingDocument),
});

export const DocumentsFile = seedFile(Documents);
export type DocumentsT = z.infer<typeof Documents>;
