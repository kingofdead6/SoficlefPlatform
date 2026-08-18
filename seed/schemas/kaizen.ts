import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/**
 * Kaizen missions and their action plans — prototype page "kaizen".
 *
 * The prototype carries two documented missions and **17** tracked actions
 * (Mission 1: 7, Mission 3: 10). CDC v1 §3.5's five-row table is a condensed view of
 * Mission 3's plan, not a separate dataset (ADR-028, OQ-23).
 */
export const KaizenMission = z.object({
  id: Id,
  number: z.number().int().min(1),
  icon: NonEmpty.nullable(),
  titleFr: NonEmpty,
  periodFr: NonEmpty,
  referenceFr: NonEmpty.nullable(),
  internalLeadFr: NonEmpty,
  contextFr: NonEmpty,
  results: z.array(z.object({ id: Id, textFr: NonEmpty })),
  journal: z.array(
    z.object({
      id: Id,
      dayFr: NonEmpty,
      activitiesFr: NonEmpty,
      outcomeFr: NonEmpty,
    }),
  ),
  gaps: z.array(
    z.object({
      id: Id,
      domainFr: NonEmpty,
      observedFr: NonEmpty,
      targetFr: NonEmpty,
    }),
  ),
});

/** A tracked action with owner, deadline and status, exactly as written. */
export const KaizenAction = z.object({
  id: Id,
  missionId: Id,
  actionFr: NonEmpty,
  ownerFr: NonEmpty,
  deadlineFr: NonEmpty,
  statusFr: NonEmpty,
});

export const Kaizen = z.object({
  programmeFr: NonEmpty,
  internalLeadFr: NonEmpty,
  missions: z.array(KaizenMission),
  actions: z.array(KaizenAction),
  priorityActionsJ30: z.array(
    z.object({ id: Id, dayLabelFr: NonEmpty, textFr: NonEmpty }),
  ),
});

export const KaizenFile = seedFile(Kaizen);
export type KaizenT = z.infer<typeof Kaizen>;
