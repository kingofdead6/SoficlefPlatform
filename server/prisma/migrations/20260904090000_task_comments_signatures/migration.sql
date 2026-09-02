-- New Hire portal (route guide §2.1) — the three pieces of state the portal needed and
-- the schema did not carry yet.
--
--   * "task_comment"   — the comment thread §2.1 asks for on a task detail page. A recruit
--     asking "where do I hand this in?" and the answer they got are part of the record of
--     the task, so they live next to the completion row rather than in a chat elsewhere.
--
--   * "task_signature" — the "e-signature (contract)" of §2.1. What is stored is an
--     *acknowledgement record*: who agreed, to exactly what statement, and when, plus a
--     SHA-256 over those four values so a later edit of the statement is detectable. It is
--     deliberately NOT a qualified electronic signature — no certificate authority, no
--     signing key, no timestamping authority is wired into this deployment — and the page
--     that writes it says so in those words. Naming the column `signatureHash` rather than
--     `signature` keeps that honest at the schema level too.
--
--   * "user"."avatarUrl" — the org-chart cards of §2.1 show a photo. Cloudinary is the
--     real store (infrastructure/storage/cloudinary.js); this column holds the returned
--     secure URL. Nullable, because most rows will not have one and a missing photo is a
--     normal state the cards render as initials.
--
-- No enum type is created for anything here, following "alert_rule"."trigger" and the
-- admin-config tables: the shapes are constrained by Zod at the route boundary.

ALTER TABLE "user" ADD COLUMN "avatarUrl" TEXT;

CREATE TABLE "task_comment" (
  "id"           UUID NOT NULL,
  "completionId" UUID NOT NULL,
  "authorId"     UUID NOT NULL,
  "bodyFr"       TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_comment_completionId_idx" ON "task_comment"("completionId");

-- CASCADE from the completion: a comment is about that task's progress and has no meaning
-- once the completion row is gone. The author is CASCADE too, matching "remark".
ALTER TABLE "task_comment"
  ADD CONSTRAINT "task_comment_completionId_fkey"
  FOREIGN KEY ("completionId") REFERENCES "onboarding_task_completion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_comment"
  ADD CONSTRAINT "task_comment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_signature" (
  "id"            UUID NOT NULL,
  "completionId"  UUID NOT NULL,
  "signerId"      UUID NOT NULL,
  "signedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- The exact wording the signer agreed to, stored verbatim: the record is worthless if
  -- the statement can be re-read from a template that has since changed.
  "statementFr"   TEXT NOT NULL,
  -- SHA-256(signerId + completionId + statementFr + signedAt ISO string).
  "signatureHash" TEXT NOT NULL,
  CONSTRAINT "task_signature_pkey" PRIMARY KEY ("id")
);

-- One acknowledgement per person per task: signing twice is not a second agreement, it is
-- a double submit, and the route refuses it rather than stacking rows.
CREATE UNIQUE INDEX "task_signature_completionId_signerId_key"
  ON "task_signature"("completionId", "signerId");

ALTER TABLE "task_signature"
  ADD CONSTRAINT "task_signature_completionId_fkey"
  FOREIGN KEY ("completionId") REFERENCES "onboarding_task_completion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_signature"
  ADD CONSTRAINT "task_signature_signerId_fkey"
  FOREIGN KEY ("signerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
