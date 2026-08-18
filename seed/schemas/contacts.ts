import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * Internal directory entry — prototype page "interlocuteurs".
 * The extension number is the business key.
 */
export const Contact = z.object({
  id: Id,
  extension: z.string().regex(/^\d{3}$/),
  initials: NonEmpty,
  nameFr: NonEmpty,
  roleFr: NonEmpty,
  priorityFr: NonEmpty,
  priorityRank: z.enum(['S1', 'S2']),
});

export const ContactsFile = seedFile(z.array(Contact));
export type ContactT = z.infer<typeof Contact>;
