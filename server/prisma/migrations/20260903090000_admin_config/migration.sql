-- Administration configuration: the tables behind the SI portal's six configuration
-- screens (route guide §2.4 — /admin/roles, /integrations, /ai, /security, /backups, /gdpr).
--
-- Until now those screens read the deployment environment and wrote nothing, so an
-- administrator could see the platform's state but never change it: every "setting" was a
-- redeploy. These tables give each screen a durable place to write, without pretending the
-- systems behind them exist:
--
--   * "connector" stores the *intended* mode and credentials of an external system. No
--     Entra tenant, SIRH API or SMTP relay is reachable from this deployment, so the test
--     endpoint reports `not_configured` rather than manufacturing a passing check.
--   * "backup_schedule" stores an intended schedule; there is no worker process in this
--     Express app to run one, which is why "backup_run" exists and starts empty. An empty
--     history here is the truth, not a missing feature.
--   * "ai_config" stores provider/model/quota/prompt choices that nothing consumes yet
--     (ADR-003 keeps business features free of an LLM dependency).
--
-- No enum types are created: `mode`, `kind` and `status` are TEXT constrained by the Zod
-- schemas at the route boundary, the same choice "alert_rule"."trigger" already makes, so
-- adding a value later is a code change rather than an ALTER TYPE under load.

-- Custom platform roles. The four built-in roles stay in domain/auth/permissions.js as
-- code — `can()` resolves them on every request and must not hit the database — so rows
-- here are additive, and a row flagged isSystem is refused for edit and delete.
CREATE TABLE "custom_role" (
  "id"            UUID NOT NULL,
  "code"          TEXT NOT NULL,
  "nameFr"        TEXT NOT NULL,
  "descriptionFr" TEXT,
  -- JSON array of "resource:action" strings, validated against the permission catalogue.
  "permissions"   JSONB NOT NULL,
  "isSystem"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_role_code_key" ON "custom_role"("code");

-- One external system and the mode it is meant to run in — the Plug & Play switch.
CREATE TABLE "connector" (
  "id"           UUID NOT NULL,
  "key"          TEXT NOT NULL,
  "labelFr"      TEXT NOT NULL,
  "mode"         TEXT NOT NULL DEFAULT 'MOCK',
  "config"       JSONB NOT NULL DEFAULT '{}',
  -- Null means never tested; false means tested and unreachable. The two are different
  -- facts and the console shows them differently.
  "lastTestedAt" TIMESTAMP(3),
  "lastTestOk"   BOOLEAN,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connector_key_key" ON "connector"("key");

-- Single-row security policy.
CREATE TABLE "security_policy" (
  "id"                UUID NOT NULL,
  "passwordMinLength" INTEGER NOT NULL DEFAULT 12,
  "mfaRequired"       BOOLEAN NOT NULL DEFAULT false,
  "sessionTtlSeconds" INTEGER NOT NULL DEFAULT 28800,
  -- JSON array of CIDR/IP strings. Empty means "no restriction in force".
  "ipAllowlist"       JSONB NOT NULL DEFAULT '[]',
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_policy_pkey" PRIMARY KEY ("id")
);

-- Declared backup schedules. Nothing executes them yet.
CREATE TABLE "backup_schedule" (
  "id"            UUID NOT NULL,
  "labelFr"       TEXT NOT NULL,
  "cronFr"        TEXT NOT NULL,
  "retentionDays" INTEGER NOT NULL DEFAULT 30,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"     TIMESTAMP(3),
  "lastRunOk"     BOOLEAN,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "backup_schedule_pkey" PRIMARY KEY ("id")
);

-- The history of executed backups: written by a worker that does not exist, therefore
-- empty by design. ON DELETE SET NULL so deleting a schedule never erases the evidence
-- that a run happened under it.
CREATE TABLE "backup_run" (
  "id"         UUID NOT NULL,
  "scheduleId" UUID,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok"         BOOLEAN NOT NULL DEFAULT false,
  "sizeBytes"  BIGINT,
  "note"       TEXT,
  CONSTRAINT "backup_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_run_scheduleId_idx" ON "backup_run"("scheduleId");
CREATE INDEX "backup_run_startedAt_idx" ON "backup_run"("startedAt");

ALTER TABLE "backup_run"
  ADD CONSTRAINT "backup_run_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "backup_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The GDPR register. A request is a tracked obligation, not a trigger: erasure has a
-- different correct answer per data category (see the /admin/gdpr inventory), so no row
-- here causes a deletion on its own.
CREATE TABLE "gdpr_request" (
  "id"            UUID NOT NULL,
  "subjectUserId" UUID,
  "kind"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'OPEN',
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"    TIMESTAMP(3),
  "noteFr"        TEXT,
  CONSTRAINT "gdpr_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gdpr_request_status_idx" ON "gdpr_request"("status");
CREATE INDEX "gdpr_request_requestedAt_idx" ON "gdpr_request"("requestedAt");

-- SET NULL rather than CASCADE: an erasure request must outlive the account it erased,
-- otherwise the register loses exactly the row that proves the obligation was met.
ALTER TABLE "gdpr_request"
  ADD CONSTRAINT "gdpr_request_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Single-row AI configuration. Nothing reads it yet (ADR-003).
CREATE TABLE "ai_config" (
  "id"              UUID NOT NULL,
  "provider"        TEXT,
  "endpoint"        TEXT,
  "model"           TEXT,
  "monthlyQuota"    INTEGER,
  -- Map of agentId -> boolean.
  "agentsEnabled"   JSONB NOT NULL DEFAULT '{}',
  -- Map of agentId -> prompt string.
  "promptTemplates" JSONB NOT NULL DEFAULT '{}',
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_config_pkey" PRIMARY KEY ("id")
);
