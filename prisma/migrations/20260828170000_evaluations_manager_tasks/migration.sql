-- Milestone evaluations and ad-hoc manager tasks.
--
-- `Assessment` already existed but answers a different question: it rates one competency
-- against the frame, at any time. What a manager owes HR at D+30 and D+90 is a review of
-- the person -- skills, autonomy, integration, behaviour -- ending in a recommendation.
-- Overloading `Assessment` would have made "which competency does 'autonomy' refer to"
-- unanswerable.

CREATE TYPE "EvaluationMilestone" AS ENUM ('DAY_30', 'DAY_90', 'PROBATION_END');
CREATE TYPE "EvaluationStatus" AS ENUM ('DUE', 'DRAFT', 'SUBMITTED');
CREATE TYPE "EvaluationRecommendation" AS ENUM ('CONFIRM', 'EXTEND', 'TERMINATE');

CREATE TABLE "evaluation" (
  "id"               UUID NOT NULL,
  "instanceId"       UUID NOT NULL,
  "subjectId"        UUID NOT NULL,
  "milestone"        "EvaluationMilestone" NOT NULL,
  "dueDate"          DATE NOT NULL,
  "status"           "EvaluationStatus" NOT NULL DEFAULT 'DUE',
  -- Nullable while the review is still due: a zero would read as "scored zero".
  "scoreSkills"      INTEGER,
  "scoreAutonomy"    INTEGER,
  "scoreIntegration" INTEGER,
  "scoreBehaviour"   INTEGER,
  "commentFr"        TEXT,
  "recommendation"   "EvaluationRecommendation",
  "evaluatorId"      UUID,
  "submittedAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_pkey" PRIMARY KEY ("id")
);

-- One review per milestone per journey. Two D+30 reviews of the same person is a data
-- error, not a second opinion.
CREATE UNIQUE INDEX "evaluation_instanceId_milestone_key" ON "evaluation"("instanceId", "milestone");
CREATE INDEX "evaluation_subjectId_idx" ON "evaluation"("subjectId");
CREATE INDEX "evaluation_status_dueDate_idx" ON "evaluation"("status", "dueDate");

ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "onboarding_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- The evaluator may leave; the evaluation stays. Set null rather than cascade.
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_evaluatorId_fkey"
  FOREIGN KEY ("evaluatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "manager_task" (
  "id"              UUID NOT NULL,
  "instanceId"      UUID NOT NULL,
  "titleFr"         TEXT NOT NULL,
  "detailFr"        TEXT,
  "dueDate"         DATE,
  "ownerDepartment" "TaskOwnerDepartment" NOT NULL DEFAULT 'MANAGER',
  "status"          "OnboardingTaskStatus" NOT NULL DEFAULT 'TODO',
  "createdById"     UUID NOT NULL,
  "completedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "manager_task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manager_task_instanceId_status_idx" ON "manager_task"("instanceId", "status");

ALTER TABLE "manager_task" ADD CONSTRAINT "manager_task_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "onboarding_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manager_task" ADD CONSTRAINT "manager_task_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
