-- "quest" — an ad-hoc task a manager assigns to any direct report, independent of onboarding.
--
-- "manager_task" already exists, but every row hangs off an "onboarding_instance" (see
-- 2026090x's route requiring "instanceId"), so it stops applying the moment someone finishes
-- onboarding and their instance is no longer the active one being read from. A manager who
-- wants to hand a routine task to an established team member has nowhere to put it. "quest"
-- is deliberately independent of the onboarding tables — it hangs off "user.managerId"
-- instead, so it works for any direct report, onboarding or not.
--
-- "status" is TEXT rather than a Postgres enum, matching "document"."visibility" in
-- 20260905090000 and "connector"."mode" in 20260903090000: constrained by Zod at the route
-- boundary, not by a DB enum type. Only two states exist (TODO/DONE) because the point of a
-- quest is a single yes/no signal from the assignee — unlike "manager_task", which mirrors the
-- five-state onboarding task lifecycle, a quest has no BLOCKED or VALIDATED state because no
-- one but the assignee acts on it.
--
-- CASCADE on both "assigneeId" and "createdById": a quest has no meaning once either party is
-- removed from the system, matching "manager_task"."createdById".

CREATE TABLE "quest" (
  "id"          UUID NOT NULL,
  "assigneeId"  UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "titleFr"     TEXT NOT NULL,
  "detailFr"    TEXT,
  "dueDate"     DATE,
  "status"      TEXT NOT NULL DEFAULT 'TODO',
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quest_assigneeId_status_idx" ON "quest"("assigneeId", "status");
CREATE INDEX "quest_createdById_idx" ON "quest"("createdById");

ALTER TABLE "quest"
  ADD CONSTRAINT "quest_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quest"
  ADD CONSTRAINT "quest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
