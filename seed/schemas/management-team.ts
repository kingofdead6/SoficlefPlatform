import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** A structure head of the Direction de Production — prototype page "encadrement". */
export const ManagementMember = z.object({
  id: Id,
  initials: NonEmpty,
  nameFr: NonEmpty,
  roleFr: NonEmpty,
  scopeFr: NonEmpty,
  tagFr: NonEmpty,
  perimeterFr: NonEmpty,
  priorityJ30Fr: NonEmpty,
});

/** A recommended first-contact action, keyed by its onboarding day offset. */
export const RecommendedAction = z.object({
  id: Id,
  dayOffset: z.number().int().min(0),
  dayLabelFr: NonEmpty,
  textFr: NonEmpty,
});

export const ManagementTeam = z.object({
  members: z.array(ManagementMember),
  recommendedActions: z.array(RecommendedAction),
});

export const ManagementTeamFile = seedFile(ManagementTeam);
export type ManagementTeamT = z.infer<typeof ManagementTeam>;
