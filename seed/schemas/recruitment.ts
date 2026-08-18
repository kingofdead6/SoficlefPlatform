import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** An open post under the Direction de Production — prototype page "recrutements". */
export const OpenPosition = z.object({
  id: Id,
  titleFr: NonEmpty,
  attachmentFr: NonEmpty,
  statusFr: NonEmpty,
});

export const Recruitment = z.object({
  positions: z.array(OpenPosition),
  internalMobilityNoteFr: NonEmpty,
  recommendedActionFr: NonEmpty,
});

export const RecruitmentFile = seedFile(Recruitment);
export type RecruitmentT = z.infer<typeof Recruitment>;
