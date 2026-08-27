-- Positions and assignments.
--
-- `job` already was a position: it carried a code, a title, a unit and a vacancy flag. It
-- is RENAMED rather than dropped and recreated, so the single existing row, its job
-- description and its twelve competency links all survive untouched.
--
-- `org_chart_node` was a second reporting tree whose `labelFr` held a person's name when a
-- post was filled and a post title when it was not. Its five rows are folded into
-- `position`, which is where they belonged; nothing is discarded.

-- ── 1. job → position ────────────────────────────────────────────────────────
ALTER TABLE "job" RENAME TO "position";

ALTER TABLE "position" RENAME CONSTRAINT "job_pkey" TO "position_pkey";
ALTER INDEX "job_code_key" RENAME TO "position_code_key";
ALTER INDEX "job_organizationUnitId_idx" RENAME TO "position_organizationUnitId_idx";

ALTER TABLE "position" ADD COLUMN "missionFr" TEXT;
ALTER TABLE "position" ADD COLUMN "parentPositionId" UUID;
ALTER TABLE "position" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "position" ADD COLUMN "occupancy" "Occupancy";
ALTER TABLE "position" ADD COLUMN "occupancyFr" TEXT;

ALTER TABLE "position"
  ADD CONSTRAINT "position_parentPositionId_fkey"
  FOREIGN KEY ("parentPositionId") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "position_parentPositionId_idx" ON "position"("parentPositionId");
CREATE INDEX "position_archivedAt_idx" ON "position"("archivedAt");

-- The one existing job is an occupied post.
UPDATE "position" SET "occupancy" = 'OCCUPIED' WHERE "occupancy" IS NULL AND "isVacant" = false;

-- ── 2. Referencing tables: jobId → positionId ────────────────────────────────
ALTER TABLE "job_description" RENAME COLUMN "jobId" TO "positionId";
ALTER TABLE "job_description" RENAME CONSTRAINT "job_description_jobId_fkey" TO "job_description_positionId_fkey";
ALTER INDEX "job_description_jobId_key" RENAME TO "job_description_positionId_key";

ALTER TABLE "job_competency" RENAME COLUMN "jobId" TO "positionId";
ALTER TABLE "job_competency" RENAME CONSTRAINT "job_competency_jobId_fkey" TO "job_competency_positionId_fkey";

ALTER TABLE "onboarding_template" RENAME COLUMN "jobId" TO "positionId";
ALTER TABLE "onboarding_template" RENAME CONSTRAINT "onboarding_template_jobId_fkey" TO "onboarding_template_positionId_fkey";
ALTER INDEX "onboarding_template_jobId_idx" RENAME TO "onboarding_template_positionId_idx";

-- ── 3. org_chart_node → position ─────────────────────────────────────────────
-- Two passes: every row first, then the parent links, so a child never references a
-- parent that has not been inserted yet.
--
-- `roleFr` is the post title where the node names a person ("DJAOUDI Farid" /
-- "Directeur de Production"), and is a vacancy notice where it does not ("Poste VACANT").
-- The title therefore comes from `roleFr` when the post is occupied and from `labelFr`
-- when it is not -- which is exactly the conflation this migration exists to undo.
INSERT INTO "position" (
  "id", "code", "titleFr", "organizationUnitId", "isVacant",
  "occupancy", "occupancyFr", "order", "createdAt", "updatedAt"
)
SELECT
  n."id",
  'orgchart-' || n."slug",
  CASE WHEN n."occupancy" = 'OCCUPIED' THEN n."roleFr" ELSE n."labelFr" END,
  n."organizationUnitId",
  n."occupancy" IS DISTINCT FROM 'OCCUPIED',
  n."occupancy",
  CASE WHEN n."occupancy" = 'OCCUPIED' THEN NULL ELSE n."roleFr" END,
  n."order",
  NOW(),
  NOW()
FROM "org_chart_node" n
ON CONFLICT ("id") DO NOTHING;

UPDATE "position" p
SET "parentPositionId" = n."parentId"
FROM "org_chart_node" n
WHERE p."id" = n."id" AND n."parentId" IS NOT NULL;

DROP TABLE "org_chart_node";

-- ── 4. Account lifecycle, alongside status rather than replacing it ──────────
CREATE TYPE "LifecycleState" AS ENUM ('PENDING_ASSIGNMENT', 'ASSIGNED', 'ARCHIVED');

ALTER TABLE "user"
  ADD COLUMN "lifecycleState" "LifecycleState" NOT NULL DEFAULT 'PENDING_ASSIGNMENT';

CREATE INDEX "user_lifecycleState_idx" ON "user"("lifecycleState");

-- ── 5. assignment ────────────────────────────────────────────────────────────
CREATE TABLE "assignment" (
  "id"                UUID NOT NULL,
  "userId"            UUID NOT NULL,
  "positionId"        UUID NOT NULL,
  "startDate"         DATE NOT NULL,
  "endDate"           DATE,
  "managerOverrideId" UUID,
  "templateId"        UUID,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assignment_userId_idx"     ON "assignment"("userId");
CREATE INDEX "assignment_positionId_idx" ON "assignment"("positionId");
CREATE INDEX "assignment_endDate_idx"    ON "assignment"("endDate");

-- One *open* assignment per person. A partial index is the only way to say "at most one
-- row where endDate IS NULL" -- a plain unique constraint would treat every closed
-- historical row as distinct and permit two current posts.
CREATE UNIQUE INDEX "assignment_one_open_per_user" ON "assignment"("userId") WHERE "endDate" IS NULL;

ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_managerOverrideId_fkey"
  FOREIGN KEY ("managerOverrideId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "onboarding_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
