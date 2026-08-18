import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** Site safety rules for Si Mustapha — prototype page "hse". */
export const Hse = z.object({
  siteFr: NonEmpty,
  contactFr: NonEmpty,
  trafficRules: z.array(z.object({ id: Id, textFr: NonEmpty })),
  mandatoryPpe: z.array(z.object({ id: Id, textFr: NonEmpty })),
  zonesFr: NonEmpty,
  riskAreaFr: NonEmpty,
  circulationPlanNoteFr: NonEmpty,
});

export const HseFile = seedFile(Hse);
export type HseT = z.infer<typeof Hse>;
