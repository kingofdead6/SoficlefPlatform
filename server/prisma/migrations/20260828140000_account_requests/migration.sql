-- Account requests: HR asks SI to create an account.
--
-- The provisioning chain runs HR -> SI -> HR, and the first hop had no record. HR could
-- not create an account and had no way to ask for one either, so the request lived in an
-- e-mail nobody could count or chase.

CREATE TYPE "AccountRequestStatus" AS ENUM ('OPEN', 'CREATED', 'REJECTED');
CREATE TYPE "AccountRequestUrgency" AS ENUM ('NORMAL', 'URGENT');

CREATE TABLE "account_request" (
  "id"                UUID NOT NULL,
  "candidateNameFr"   TEXT NOT NULL,
  "plannedPositionFr" TEXT NOT NULL,
  "plannedHireDate"   DATE,
  "urgency"           "AccountRequestUrgency" NOT NULL DEFAULT 'NORMAL',
  "noteFr"            TEXT,
  "status"            "AccountRequestStatus" NOT NULL DEFAULT 'OPEN',
  "requestedById"     UUID NOT NULL,
  -- Set once SI has created the account, so the two halves of the handoff can be joined
  -- and the delay between them measured.
  "createdUserId"     UUID,
  "resolvedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_request_status_createdAt_idx" ON "account_request"("status", "createdAt");

ALTER TABLE "account_request"
  ADD CONSTRAINT "account_request_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_request"
  ADD CONSTRAINT "account_request_createdUserId_fkey"
  FOREIGN KEY ("createdUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
