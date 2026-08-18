import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * A milestone of the 30-day checklist — prototype page "checklist".
 * `order` preserves the prototype's sequence; several milestones share a day.
 */
export const OnboardingMilestone = z.object({
  id: Id,
  order: z.number().int().min(1),
  dayLabelFr: z.string().regex(/^J\+\d+$/),
  dayOffset: z.number().int().min(0),
  titleFr: NonEmpty,
  detailFr: NonEmpty,
  isRecommended: z.boolean(),
});

export const OnboardingFile = seedFile(z.array(OnboardingMilestone));
export type OnboardingMilestoneT = z.infer<typeof OnboardingMilestone>;
