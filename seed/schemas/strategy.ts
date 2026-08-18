import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** One row of the 2024–2026 market objectives table — prototype page "strategie". */
export const MarketObjective = z.object({
  id: Id,
  marketFr: NonEmpty,
  strategyFr: NonEmpty,
  marketShareTargetFr: NonEmpty,
  revenueTargetFr: NonEmpty,
});

/** A strategic project PS-01 … PS-04, keyed by its business code. */
export const StrategicProject = z.object({
  code: z.string().regex(/^PS-\d{2}$/),
  titleFr: NonEmpty,
  descriptionFr: NonEmpty,
});

/** A progress row of the "Contribution DPR aux objectifs" block. */
export const StrategyContribution = z.object({
  id: Id,
  labelFr: NonEmpty,
  targetFr: NonEmpty,
  progressPercent: z.number().int().min(0).max(100),
});

export const Strategy = z.object({
  planFr: NonEmpty,
  globalObjectiveFr: NonEmpty,
  markets: z.array(MarketObjective),
  projects: z.array(StrategicProject),
  contributions: z.array(StrategyContribution),
});

export const StrategyFile = seedFile(Strategy);
export type StrategyT = z.infer<typeof Strategy>;
