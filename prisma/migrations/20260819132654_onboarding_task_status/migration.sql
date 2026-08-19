-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VALIDATED');

-- AlterTable
ALTER TABLE "onboarding_task_completion" ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" UUID;
