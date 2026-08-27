-- Document acknowledgements and personal files, for `/app/me`.
--
-- Two things the recruit's own surface needs and the model could not express: proof that
-- somebody read a mandatory document, and the administrative papers they owe HR.

CREATE TABLE "document_acknowledgement" (
  "id"         UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "userId"     UUID NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_acknowledgement_pkey" PRIMARY KEY ("id")
);

-- One acknowledgement per person per document: re-reading is not re-accepting, and a
-- second row would make "who has accepted" a count of clicks rather than of people.
CREATE UNIQUE INDEX "document_acknowledgement_documentId_userId_key"
  ON "document_acknowledgement"("documentId", "userId");
CREATE INDEX "document_acknowledgement_userId_idx" ON "document_acknowledgement"("userId");

ALTER TABLE "document_acknowledgement"
  ADD CONSTRAINT "document_acknowledgement_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_acknowledgement"
  ADD CONSTRAINT "document_acknowledgement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "PersonalFileKind" AS ENUM
  ('ID_CARD', 'DIPLOMA', 'BANK_DETAILS', 'MEDICAL_CERTIFICATE', 'OTHER');
CREATE TYPE "PersonalFileStatus" AS ENUM
  ('REQUESTED', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "personal_file" (
  "id"          UUID NOT NULL,
  "userId"      UUID NOT NULL,
  "kind"        "PersonalFileKind" NOT NULL,
  "labelFr"     TEXT NOT NULL,
  "status"      "PersonalFileStatus" NOT NULL DEFAULT 'REQUESTED',
  "fileName"    TEXT,
  -- Where the bytes live. Null until a storage backend is chosen (OQ-14/OQ-15): the
  -- workflow, the statuses and the HR review all work without it, and wiring a backend
  -- later fills this column rather than changing the model.
  "storageKey"  TEXT,
  "noteFr"      TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt"  TIMESTAMP(3),
  "reviewedBy"  UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_file_pkey" PRIMARY KEY ("id")
);

-- One row per kind per person: "your ID card" is one obligation with one status, not a
-- growing list of attempts.
CREATE UNIQUE INDEX "personal_file_userId_kind_key" ON "personal_file"("userId", "kind");
CREATE INDEX "personal_file_status_idx" ON "personal_file"("status");

ALTER TABLE "personal_file"
  ADD CONSTRAINT "personal_file_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
