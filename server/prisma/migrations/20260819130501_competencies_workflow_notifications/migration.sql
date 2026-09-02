-- CreateEnum
CREATE TYPE "JobDescriptionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'VALIDATED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "competency" ADD COLUMN     "familyId" UUID;

-- CreateTable
CREATE TABLE "competency_family" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "descriptionFr" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_level" (
    "id" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "labelEn" TEXT,
    "definitionFr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_version" (
    "id" UUID NOT NULL,
    "jobDescriptionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "JobDescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "reasonFr" TEXT,
    "authorId" UUID,
    "validatedBy" UUID,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "commentFr" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "bodyFr" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_family_code_key" ON "competency_family"("code");

-- CreateIndex
CREATE UNIQUE INDEX "competency_level_value_key" ON "competency_level"("value");

-- CreateIndex
CREATE INDEX "job_description_version_status_idx" ON "job_description_version"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_version_jobDescriptionId_versionNumber_key" ON "job_description_version"("jobDescriptionId", "versionNumber");

-- CreateIndex
CREATE INDEX "workflow_action_entityType_entityId_idx" ON "workflow_action"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "workflow_action_actorId_idx" ON "workflow_action"("actorId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "competency_family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_version" ADD CONSTRAINT "job_description_version_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_description"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
