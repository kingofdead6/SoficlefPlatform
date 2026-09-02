-- Alert rules: the reminder/escalation policy behind the HR alerts engine.
--
-- The alerts the manager portal shows are derived from the data at read time. What was
-- missing is the rule that produced them: after how many days an overdue task becomes a
-- reminder, who is notified, and when it escalates. Storing that as rows rather than as
-- JSON in "app_setting" keeps "which rules are active" a query rather than a parse.
--
-- `notifyDepartment` reuses the existing "TaskOwnerDepartment" enum: the departments that
-- own onboarding tasks are exactly the departments a reminder can be addressed to, and a
-- second, parallel enum would drift from it.

CREATE TABLE "alert_rule" (
  "id"                UUID NOT NULL,
  "labelFr"           TEXT NOT NULL,
  "trigger"           TEXT NOT NULL,
  "thresholdDays"     INTEGER NOT NULL DEFAULT 3,
  "notifyDepartment"  "TaskOwnerDepartment" NOT NULL DEFAULT 'HR',
  -- Null means "never escalates": absence of an escalation is not a zero-day escalation.
  "escalateAfterDays" INTEGER,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_rule_isActive_trigger_idx" ON "alert_rule"("isActive", "trigger");
