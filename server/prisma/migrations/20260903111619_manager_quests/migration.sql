-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('TODO', 'DONE');

-- DropIndex
DROP INDEX "alert_rule_isActive_trigger_idx";

-- CreateTable
CREATE TABLE "quest" (
    "id" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "titleFr" TEXT NOT NULL,
    "detailFr" TEXT,
    "dueDate" DATE,
    "status" "QuestStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quest_assigneeId_status_idx" ON "quest"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "quest_createdById_idx" ON "quest"("createdById");

-- RenameForeignKey
ALTER TABLE "position" RENAME CONSTRAINT "job_organizationUnitId_fkey" TO "position_organizationUnitId_fkey";

-- AddForeignKey
ALTER TABLE "quest" ADD CONSTRAINT "quest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest" ADD CONSTRAINT "quest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
