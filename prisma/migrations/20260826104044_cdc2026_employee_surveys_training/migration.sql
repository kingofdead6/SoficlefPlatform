-- CreateEnum
CREATE TYPE "OnboardingPhase" AS ENUM ('PRE_ONBOARDING', 'DAY_ONE', 'PROBATION');

-- CreateEnum
CREATE TYPE "TaskOwnerDepartment" AS ENUM ('HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProbationOutcome" AS ENUM ('ONGOING', 'CONFIRMED', 'EXTENDED', 'TERMINATED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "SurveyIndicator" AS ENUM ('WELCOME_QUALITY', 'SUPPORT_LEVEL', 'ROLE_CLARITY', 'MANAGER_RELATIONSHIP', 'WORKING_CONDITIONS');

-- AlterTable
ALTER TABLE "onboarding_instance" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "outcomeRecordedAt" TIMESTAMP(3),
ADD COLUMN     "probationEndsOn" DATE,
ADD COLUMN     "probationOutcome" "ProbationOutcome" NOT NULL DEFAULT 'ONGOING';

-- AlterTable
ALTER TABLE "onboarding_milestone" ADD COLUMN     "ownerDepartment" "TaskOwnerDepartment",
ADD COLUMN     "phase" "OnboardingPhase";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "directionFr" TEXT,
ADD COLUMN     "hireDate" DATE,
ADD COLUMN     "managerId" UUID,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "positionTitleFr" TEXT,
ADD COLUMN     "serviceFr" TEXT;

-- CreateTable
CREATE TABLE "survey_round" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_response" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "indicator" "SurveyIndicator" NOT NULL,
    "score" INTEGER NOT NULL,
    "commentFr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_module" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "summaryFr" TEXT NOT NULL,
    "contentFr" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_question" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "promptFr" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" TEXT NOT NULL,
    "explanationFr" TEXT,

    CONSTRAINT "training_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attempt" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),

    CONSTRAINT "training_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_round_dueDate_answeredAt_idx" ON "survey_round"("dueDate", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "survey_round_instanceId_dayOffset_key" ON "survey_round"("instanceId", "dayOffset");

-- CreateIndex
CREATE INDEX "survey_response_userId_idx" ON "survey_response"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_response_roundId_indicator_key" ON "survey_response"("roundId", "indicator");

-- CreateIndex
CREATE UNIQUE INDEX "training_module_code_key" ON "training_module"("code");

-- CreateIndex
CREATE INDEX "training_question_moduleId_idx" ON "training_question"("moduleId");

-- CreateIndex
CREATE INDEX "training_attempt_userId_moduleId_idx" ON "training_attempt"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "training_attempt_moduleId_passed_idx" ON "training_attempt"("moduleId", "passed");

-- CreateIndex
CREATE INDEX "user_managerId_idx" ON "user"("managerId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_round" ADD CONSTRAINT "survey_round_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "onboarding_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "survey_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_question" ADD CONSTRAINT "training_question_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "training_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "training_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attempt" ADD CONSTRAINT "training_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
