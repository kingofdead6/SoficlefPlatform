import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * The official job description of the Directeur de Production — prototype page "poste".
 * Document code EN-012-DRH, application date 19.08.2018.
 */
export const JobDescription = z.object({
  code: z.literal('EN-012-DRH'),
  jobTitleFr: NonEmpty,
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  applicationDateSourceFr: NonEmpty,
  positioning: z.object({
    structureFr: NonEmpty,
    processFr: NonEmpty,
    reportsToFr: NonEmpty,
    subordinatesFr: NonEmpty,
  }),
  requirements: z.object({
    educationFr: NonEmpty,
    additionalEducationFr: NonEmpty,
    experienceFr: NonEmpty,
    workPatternFr: NonEmpty,
  }),
  missions: z.array(z.object({ id: Id, textFr: NonEmpty })),
  permanentTasks: z.array(z.object({ id: Id, textFr: NonEmpty })),
  responsibilities: z.array(z.object({ id: Id, textFr: NonEmpty })),
});

export const JobDescriptionFile = seedFile(JobDescription);
export type JobDescriptionT = z.infer<typeof JobDescription>;
