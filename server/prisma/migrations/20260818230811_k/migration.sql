-- CreateEnum
CREATE TYPE "Occupancy" AS ENUM ('VACANT', 'TO_FILL', 'OCCUPIED');

-- CreateEnum
CREATE TYPE "QmsProcessCategory" AS ENUM ('MANAGEMENT', 'REALISATION', 'SUPPORT');

-- CreateEnum
CREATE TYPE "HseRuleKind" AS ENUM ('TRAFFIC', 'PPE');

-- CreateEnum
CREATE TYPE "ContactPriority" AS ENUM ('S1', 'S2');

-- CreateEnum
CREATE TYPE "DocumentAvailability" AS ENUM ('AVAILABLE', 'PENDING');

-- AlterTable
ALTER TABLE "organization_unit" ADD COLUMN     "criticalNoteFr" TEXT,
ADD COLUMN     "descriptionFr" TEXT,
ADD COLUMN     "headLabelFr" TEXT,
ADD COLUMN     "headOccupancy" "Occupancy",
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "staffingFr" TEXT;

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "legalForm" TEXT NOT NULL,
    "foundedYear" INTEGER NOT NULL,
    "foundedCity" TEXT NOT NULL,
    "headquarters" TEXT NOT NULL,
    "generalManager" TEXT NOT NULL,
    "certification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "visionFr" TEXT NOT NULL,
    "missionFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_activity" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "labelFr" TEXT NOT NULL,
    "contentFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "company_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_value" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,

    CONSTRAINT "company_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "planFr" TEXT NOT NULL,
    "globalObjectiveFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_objective" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "strategyId" UUID NOT NULL,
    "marketFr" TEXT NOT NULL,
    "strategyFr" TEXT NOT NULL,
    "marketShareTargetFr" TEXT NOT NULL,
    "revenueTargetFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "market_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_project" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "strategyId" UUID NOT NULL,
    "titleFr" TEXT NOT NULL,
    "descriptionFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "strategic_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_contribution" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "strategyId" UUID NOT NULL,
    "labelFr" TEXT NOT NULL,
    "targetFr" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "strategy_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "organizationUnitId" UUID,
    "isVacant" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "jobId" UUID,
    "jobTitleFr" TEXT NOT NULL,
    "applicationDate" DATE NOT NULL,
    "applicationDateSourceFr" TEXT NOT NULL,
    "positioningStructureFr" TEXT NOT NULL,
    "positioningProcessFr" TEXT NOT NULL,
    "positioningReportsToFr" TEXT NOT NULL,
    "positioningSubordinatesFr" TEXT NOT NULL,
    "requirementEducationFr" TEXT NOT NULL,
    "requirementAdditionalEducationFr" TEXT NOT NULL,
    "requirementExperienceFr" TEXT NOT NULL,
    "requirementWorkPatternFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_mission" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "jobDescriptionId" UUID NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "job_description_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_task" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "jobDescriptionId" UUID NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "job_description_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_responsibility" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "jobDescriptionId" UUID NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "job_description_responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "nameFr" TEXT NOT NULL,
    "categoryFr" TEXT,
    "descriptionFr" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_competency" (
    "jobId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "notesFr" TEXT,

    CONSTRAINT "job_competency_pkey" PRIMARY KEY ("jobId","competencyId")
);

-- CreateTable
CREATE TABLE "assessment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "assessedBy" UUID NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notesFr" TEXT,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_member" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationUnitId" UUID,
    "initials" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "roleFr" TEXT NOT NULL,
    "scopeFr" TEXT NOT NULL,
    "tagFr" TEXT NOT NULL,
    "perimeterFr" TEXT NOT NULL,
    "priorityJ30Fr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "management_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_recommended_action" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "dayLabelFr" TEXT NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "management_recommended_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_chart_node" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "roleFr" TEXT NOT NULL,
    "occupancy" "Occupancy",
    "parentId" UUID,
    "organizationUnitId" UUID,
    "order" INTEGER NOT NULL,

    CONSTRAINT "org_chart_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_programme" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "programmeFr" TEXT NOT NULL,
    "internalLeadFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kaizen_programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_mission" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "programmeId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "icon" TEXT,
    "titleFr" TEXT NOT NULL,
    "periodFr" TEXT NOT NULL,
    "referenceFr" TEXT,
    "internalLeadFr" TEXT NOT NULL,
    "contextFr" TEXT NOT NULL,

    CONSTRAINT "kaizen_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_mission_result" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "missionId" UUID NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "kaizen_mission_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_journal_entry" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "missionId" UUID NOT NULL,
    "dayFr" TEXT NOT NULL,
    "activitiesFr" TEXT NOT NULL,
    "outcomeFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "kaizen_journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_gap" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "missionId" UUID NOT NULL,
    "domainFr" TEXT NOT NULL,
    "observedFr" TEXT NOT NULL,
    "targetFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "kaizen_gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_action" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "missionId" UUID NOT NULL,
    "actionFr" TEXT NOT NULL,
    "ownerFr" TEXT NOT NULL,
    "deadlineFr" TEXT NOT NULL,
    "statusFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "kaizen_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaizen_priority_action_j30" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "programmeId" UUID NOT NULL,
    "dayLabelFr" TEXT NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "kaizen_priority_action_j30_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qms" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "standardFr" TEXT NOT NULL,
    "certificationBodyFr" TEXT NOT NULL,
    "certifiedSinceFr" TEXT NOT NULL,
    "certificationScopeFr" TEXT NOT NULL,
    "ownedProcessCode" TEXT NOT NULL,
    "ownedProcessNoteFr" TEXT NOT NULL,
    "processMapCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qms_responsibility" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "qmsId" UUID NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "qms_responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qms_process" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "qmsId" UUID NOT NULL,
    "category" "QmsProcessCategory" NOT NULL,
    "categoryLabelFr" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "isOwnedByProductionDirector" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "qms_process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hse" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "siteFr" TEXT NOT NULL,
    "contactFr" TEXT NOT NULL,
    "zonesFr" TEXT NOT NULL,
    "riskAreaFr" TEXT NOT NULL,
    "circulationPlanNoteFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hse_rule" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "hseId" UUID NOT NULL,
    "kind" "HseRuleKind" NOT NULL,
    "textFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "hse_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" UUID NOT NULL,
    "extension" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "roleFr" TEXT NOT NULL,
    "priorityFr" TEXT NOT NULL,
    "priorityRank" "ContactPriority" NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "fileName" TEXT,
    "titleFr" TEXT NOT NULL,
    "detailFr" TEXT,
    "availability" "DocumentAvailability" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "internalMobilityNoteFr" TEXT NOT NULL,
    "recommendedActionFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_position" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "recruitmentId" UUID NOT NULL,
    "titleFr" TEXT NOT NULL,
    "attachmentFr" TEXT NOT NULL,
    "statusFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "open_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" UUID,
    "recipientFr" TEXT NOT NULL,
    "recipientRoleFr" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "startDateSourceFr" TEXT NOT NULL,
    "greetingFr" TEXT NOT NULL,
    "messageFr" TEXT NOT NULL,
    "signatureFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome_stat" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "welcomeId" UUID NOT NULL,
    "valueFr" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "welcome_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome_agenda_item" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "welcomeId" UUID NOT NULL,
    "titleFr" TEXT NOT NULL,
    "detailFr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "welcome_agenda_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_template" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "jobId" UUID,
    "titleFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_milestone" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "templateId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "dayLabelFr" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "titleFr" TEXT NOT NULL,
    "detailFr" TEXT NOT NULL,
    "isRecommended" BOOLEAN NOT NULL,

    CONSTRAINT "onboarding_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_instance" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_task_completion" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedBy" UUID,
    "noteFr" TEXT,

    CONSTRAINT "onboarding_task_completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remark" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "contentFr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_slug_key" ON "company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_activity_slug_key" ON "company_activity"("slug");

-- CreateIndex
CREATE INDEX "company_activity_companyId_idx" ON "company_activity"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_value_slug_key" ON "company_value"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_slug_key" ON "strategy"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "market_objective_slug_key" ON "market_objective"("slug");

-- CreateIndex
CREATE INDEX "market_objective_strategyId_idx" ON "market_objective"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "strategic_project_code_key" ON "strategic_project"("code");

-- CreateIndex
CREATE INDEX "strategic_project_strategyId_idx" ON "strategic_project"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_contribution_slug_key" ON "strategy_contribution"("slug");

-- CreateIndex
CREATE INDEX "strategy_contribution_strategyId_idx" ON "strategy_contribution"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "job_code_key" ON "job"("code");

-- CreateIndex
CREATE INDEX "job_organizationUnitId_idx" ON "job"("organizationUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_code_key" ON "job_description"("code");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_jobId_key" ON "job_description"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_mission_slug_key" ON "job_description_mission"("slug");

-- CreateIndex
CREATE INDEX "job_description_mission_jobDescriptionId_idx" ON "job_description_mission"("jobDescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_task_slug_key" ON "job_description_task"("slug");

-- CreateIndex
CREATE INDEX "job_description_task_jobDescriptionId_idx" ON "job_description_task"("jobDescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "job_description_responsibility_slug_key" ON "job_description_responsibility"("slug");

-- CreateIndex
CREATE INDEX "job_description_responsibility_jobDescriptionId_idx" ON "job_description_responsibility"("jobDescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_code_key" ON "competency"("code");

-- CreateIndex
CREATE INDEX "job_competency_competencyId_idx" ON "job_competency"("competencyId");

-- CreateIndex
CREATE INDEX "assessment_userId_idx" ON "assessment"("userId");

-- CreateIndex
CREATE INDEX "assessment_competencyId_idx" ON "assessment"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "management_member_slug_key" ON "management_member"("slug");

-- CreateIndex
CREATE INDEX "management_member_organizationUnitId_idx" ON "management_member"("organizationUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "management_recommended_action_slug_key" ON "management_recommended_action"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_chart_node_slug_key" ON "org_chart_node"("slug");

-- CreateIndex
CREATE INDEX "org_chart_node_parentId_idx" ON "org_chart_node"("parentId");

-- CreateIndex
CREATE INDEX "org_chart_node_organizationUnitId_idx" ON "org_chart_node"("organizationUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_programme_slug_key" ON "kaizen_programme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_mission_slug_key" ON "kaizen_mission"("slug");

-- CreateIndex
CREATE INDEX "kaizen_mission_programmeId_idx" ON "kaizen_mission"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_mission_result_slug_key" ON "kaizen_mission_result"("slug");

-- CreateIndex
CREATE INDEX "kaizen_mission_result_missionId_idx" ON "kaizen_mission_result"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_journal_entry_slug_key" ON "kaizen_journal_entry"("slug");

-- CreateIndex
CREATE INDEX "kaizen_journal_entry_missionId_idx" ON "kaizen_journal_entry"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_gap_slug_key" ON "kaizen_gap"("slug");

-- CreateIndex
CREATE INDEX "kaizen_gap_missionId_idx" ON "kaizen_gap"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_action_slug_key" ON "kaizen_action"("slug");

-- CreateIndex
CREATE INDEX "kaizen_action_missionId_idx" ON "kaizen_action"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "kaizen_priority_action_j30_slug_key" ON "kaizen_priority_action_j30"("slug");

-- CreateIndex
CREATE INDEX "kaizen_priority_action_j30_programmeId_idx" ON "kaizen_priority_action_j30"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "qms_slug_key" ON "qms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "qms_responsibility_slug_key" ON "qms_responsibility"("slug");

-- CreateIndex
CREATE INDEX "qms_responsibility_qmsId_idx" ON "qms_responsibility"("qmsId");

-- CreateIndex
CREATE UNIQUE INDEX "qms_process_code_key" ON "qms_process"("code");

-- CreateIndex
CREATE INDEX "qms_process_qmsId_idx" ON "qms_process"("qmsId");

-- CreateIndex
CREATE UNIQUE INDEX "hse_slug_key" ON "hse"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "hse_rule_slug_key" ON "hse_rule"("slug");

-- CreateIndex
CREATE INDEX "hse_rule_hseId_idx" ON "hse_rule"("hseId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_extension_key" ON "contact"("extension");

-- CreateIndex
CREATE UNIQUE INDEX "document_slug_key" ON "document"("slug");

-- CreateIndex
CREATE INDEX "document_availability_idx" ON "document"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_slug_key" ON "recruitment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "open_position_slug_key" ON "open_position"("slug");

-- CreateIndex
CREATE INDEX "open_position_recruitmentId_idx" ON "open_position"("recruitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_slug_key" ON "welcome"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_userId_key" ON "welcome"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_stat_slug_key" ON "welcome_stat"("slug");

-- CreateIndex
CREATE INDEX "welcome_stat_welcomeId_idx" ON "welcome_stat"("welcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_agenda_item_slug_key" ON "welcome_agenda_item"("slug");

-- CreateIndex
CREATE INDEX "welcome_agenda_item_welcomeId_idx" ON "welcome_agenda_item"("welcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_template_slug_key" ON "onboarding_template"("slug");

-- CreateIndex
CREATE INDEX "onboarding_template_jobId_idx" ON "onboarding_template"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_milestone_slug_key" ON "onboarding_milestone"("slug");

-- CreateIndex
CREATE INDEX "onboarding_milestone_templateId_idx" ON "onboarding_milestone"("templateId");

-- CreateIndex
CREATE INDEX "onboarding_instance_userId_idx" ON "onboarding_instance"("userId");

-- CreateIndex
CREATE INDEX "onboarding_instance_templateId_idx" ON "onboarding_instance"("templateId");

-- CreateIndex
CREATE INDEX "onboarding_task_completion_milestoneId_idx" ON "onboarding_task_completion"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_task_completion_instanceId_milestoneId_key" ON "onboarding_task_completion"("instanceId", "milestoneId");

-- CreateIndex
CREATE INDEX "remark_authorId_idx" ON "remark"("authorId");

-- AddForeignKey
ALTER TABLE "company_activity" ADD CONSTRAINT "company_activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_objective" ADD CONSTRAINT "market_objective_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_project" ADD CONSTRAINT "strategic_project_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_contribution" ADD CONSTRAINT "strategy_contribution_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description" ADD CONSTRAINT "job_description_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_mission" ADD CONSTRAINT "job_description_mission_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_description"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_task" ADD CONSTRAINT "job_description_task_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_description"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_responsibility" ADD CONSTRAINT "job_description_responsibility_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_description"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competency" ADD CONSTRAINT "job_competency_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competency" ADD CONSTRAINT "job_competency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_member" ADD CONSTRAINT "management_member_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_chart_node" ADD CONSTRAINT "org_chart_node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_chart_node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_chart_node" ADD CONSTRAINT "org_chart_node_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_mission" ADD CONSTRAINT "kaizen_mission_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "kaizen_programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_mission_result" ADD CONSTRAINT "kaizen_mission_result_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "kaizen_mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_journal_entry" ADD CONSTRAINT "kaizen_journal_entry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "kaizen_mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_gap" ADD CONSTRAINT "kaizen_gap_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "kaizen_mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_action" ADD CONSTRAINT "kaizen_action_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "kaizen_mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaizen_priority_action_j30" ADD CONSTRAINT "kaizen_priority_action_j30_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "kaizen_programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qms_responsibility" ADD CONSTRAINT "qms_responsibility_qmsId_fkey" FOREIGN KEY ("qmsId") REFERENCES "qms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qms_process" ADD CONSTRAINT "qms_process_qmsId_fkey" FOREIGN KEY ("qmsId") REFERENCES "qms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hse_rule" ADD CONSTRAINT "hse_rule_hseId_fkey" FOREIGN KEY ("hseId") REFERENCES "hse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_position" ADD CONSTRAINT "open_position_recruitmentId_fkey" FOREIGN KEY ("recruitmentId") REFERENCES "recruitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welcome" ADD CONSTRAINT "welcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welcome_stat" ADD CONSTRAINT "welcome_stat_welcomeId_fkey" FOREIGN KEY ("welcomeId") REFERENCES "welcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welcome_agenda_item" ADD CONSTRAINT "welcome_agenda_item_welcomeId_fkey" FOREIGN KEY ("welcomeId") REFERENCES "welcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_template" ADD CONSTRAINT "onboarding_template_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_milestone" ADD CONSTRAINT "onboarding_milestone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "onboarding_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_instance" ADD CONSTRAINT "onboarding_instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_instance" ADD CONSTRAINT "onboarding_instance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "onboarding_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task_completion" ADD CONSTRAINT "onboarding_task_completion_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "onboarding_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task_completion" ADD CONSTRAINT "onboarding_task_completion_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "onboarding_milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remark" ADD CONSTRAINT "remark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
