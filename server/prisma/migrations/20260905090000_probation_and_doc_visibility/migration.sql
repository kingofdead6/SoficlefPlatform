-- Two additions to the HR portal.
--
--   * "probation_decision" — the trial-period (période d'essai) decision HR records once the
--     responsable's evaluation is in. The four 1–5 scores already live on "evaluation"; what
--     was missing is the *decision*, which is a separate fact from the arithmetic:
--     domain/onboarding/probation.js computes a percentage and a suggested outcome, and HR
--     either accepts that suggestion or records a different one with a reason. Keeping the
--     suggestion and the decision in the same row is the point — it is what makes a later
--     reader able to see that somebody overrode the score, and why.
--
--     "reasonFr" is nullable at the schema level and REQUIRED by the route whenever
--     decidedOutcome differs from suggestedOutcome. The constraint is not expressed in SQL
--     because it is a rule about the *pair* of columns that the route already enforces
--     alongside the rest of its validation, and a CHECK here would silently reject a future
--     backfill rather than explaining itself.
--
--     "scorePercent", "suggestedOutcome" and "decidedOutcome" are stored, not recomputed on
--     read: the decision is a historical record of what was on screen when it was taken. If
--     the thresholds are ever retuned, past decisions must not retroactively change meaning.
--
--   * "document"."visibility" / "document"."departmentsFr" — HR publishes a document to a
--     targeted department rather than to everyone. "ALL" (the default, and what every
--     existing row becomes) keeps today's behaviour exactly: visible to anyone holding
--     document:read. "DEPARTMENTS" restricts it to callers whose "directionFr" or
--     "serviceFr" appears in the "departmentsFr" array — plus anyone holding document:create,
--     who must be able to see what they publish.
--
-- No enum type is created for "visibility", following "connector"."mode" in
-- 20260903090000_admin_config and "alert_rule"."trigger": these are TEXT columns constrained
-- by Zod at the route boundary.

-- ---------------------------------------------------------------------------
-- Document visibility
-- ---------------------------------------------------------------------------

-- Existing rows default to ALL: adding a targeting feature must not retroactively hide any
-- document that people can read today.
ALTER TABLE "document" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'ALL';

-- An array of department names matched against "user"."directionFr" / "user"."serviceFr".
-- JSONB rather than TEXT[] to match how the rest of this schema stores list-shaped values
-- through Prisma's Json type.
ALTER TABLE "document" ADD COLUMN "departmentsFr" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "document_visibility_idx" ON "document"("visibility");

-- ---------------------------------------------------------------------------
-- Probation decisions
-- ---------------------------------------------------------------------------

CREATE TABLE "probation_decision" (
  "id"               UUID NOT NULL,
  "instanceId"       UUID NOT NULL,
  -- Nullable + SET NULL: the decision survives the evaluation being removed. What the
  -- decision was and why stays readable even if the form behind it is gone.
  "evaluationId"     UUID,
  -- 0–100, computed server-side from the four scores at the moment of the decision.
  "scorePercent"     INTEGER NOT NULL,
  -- ProbationOutcome values as TEXT: what the thresholds suggested, and what HR chose.
  "suggestedOutcome" TEXT NOT NULL,
  "decidedOutcome"   TEXT NOT NULL,
  -- Required by the route when decidedOutcome <> suggestedOutcome; see the header note.
  "reasonFr"         TEXT,
  "decidedById"      UUID NOT NULL,
  "decidedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "probation_decision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "probation_decision_instanceId_idx" ON "probation_decision"("instanceId");

-- CASCADE from the instance: the decision is about that onboarding and has no meaning
-- without it, matching "evaluation" and "manager_task".
ALTER TABLE "probation_decision"
  ADD CONSTRAINT "probation_decision_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "onboarding_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "probation_decision"
  ADD CONSTRAINT "probation_decision_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RESTRICT on the decider: who took this decision is the substance of the record, and a
-- decision whose author has been erased is not a record of anything.
ALTER TABLE "probation_decision"
  ADD CONSTRAINT "probation_decision_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
