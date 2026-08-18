import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** Company identity, vision, mission, activities and logistics — prototype page "entreprise". */
export const Company = z.object({
  id: Id,
  legalName: NonEmpty,
  legalForm: NonEmpty,
  foundedYear: z.number().int().min(1900).max(2100),
  foundedCity: NonEmpty,
  headquarters: NonEmpty,
  generalManager: NonEmpty,
  certification: NonEmpty,
  status: NonEmpty,
  website: NonEmpty,
  visionFr: NonEmpty,
  missionFr: NonEmpty,
  activities: z
    .array(z.object({ id: Id, labelFr: NonEmpty, contentFr: NonEmpty }))
    .min(1),
});

export const CompanyFile = seedFile(Company);
export type CompanyT = z.infer<typeof Company>;
