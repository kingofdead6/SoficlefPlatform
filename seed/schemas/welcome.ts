import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * Welcome page content — prototype page "bienvenue".
 *
 * Not listed in the build brief's inventory table but present in the prototype and
 * needed by Part 6's /welcome route, so it is extracted rather than retyped later
 * (see CONTENT-INVENTORY.md, "beyond the brief's inventory").
 */
export const Welcome = z.object({
  recipientFr: NonEmpty,
  recipientRoleFr: NonEmpty,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDateSourceFr: NonEmpty,
  greetingFr: NonEmpty,
  messageFr: NonEmpty,
  signatureFr: NonEmpty,
  stats: z.array(z.object({ id: Id, valueFr: NonEmpty, labelFr: NonEmpty })),
  agenda: z.array(z.object({ id: Id, titleFr: NonEmpty, detailFr: NonEmpty })),
});

export const WelcomeFile = seedFile(Welcome);
export type WelcomeT = z.infer<typeof Welcome>;
