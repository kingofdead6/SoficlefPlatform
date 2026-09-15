-- Arabic and English columns for the content the anonymous public pages render.
--
-- The public pages (/, /entreprise, /strategie, /organigramme) were already translated in
-- their chrome — every label, heading and CTA comes from the FR/EN/AR catalogues — but the
-- text that carries the actual meaning (the mission, the vision, each trade, each market,
-- each strategic project, each unit's description) is database content, and the tables only
-- ever had an "Fr" column. A visitor switching to EN or AR therefore got English or Arabic
-- furniture around French prose.
--
-- Every column added here is NULLABLE on purpose, and nothing backfills them: an untranslated
-- row must keep rendering its French text rather than a blank, so the readers resolve
-- <field>En / <field>Ar and fall back to <field>Fr. That makes translating incremental —
-- a row becomes trilingual the moment someone fills it in, with no migration in between.
--
-- "organization_unit" already carried "nameAr"/"nameEn"; only its description was missing,
-- which is why this is the one table with a single pair of columns rather than two.

ALTER TABLE "organization_unit"
  ADD COLUMN "descriptionAr" TEXT,
  ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "company"
  ADD COLUMN "visionAr"  TEXT,
  ADD COLUMN "visionEn"  TEXT,
  ADD COLUMN "missionAr" TEXT,
  ADD COLUMN "missionEn" TEXT;

ALTER TABLE "company_activity"
  ADD COLUMN "labelAr"   TEXT,
  ADD COLUMN "labelEn"   TEXT,
  ADD COLUMN "contentAr" TEXT,
  ADD COLUMN "contentEn" TEXT;

ALTER TABLE "strategy"
  ADD COLUMN "planAr"            TEXT,
  ADD COLUMN "planEn"            TEXT,
  ADD COLUMN "globalObjectiveAr" TEXT,
  ADD COLUMN "globalObjectiveEn" TEXT;

ALTER TABLE "market_objective"
  ADD COLUMN "marketAr"   TEXT,
  ADD COLUMN "marketEn"   TEXT,
  ADD COLUMN "strategyAr" TEXT,
  ADD COLUMN "strategyEn" TEXT;

ALTER TABLE "strategic_project"
  ADD COLUMN "titleAr"       TEXT,
  ADD COLUMN "titleEn"       TEXT,
  ADD COLUMN "descriptionAr" TEXT,
  ADD COLUMN "descriptionEn" TEXT;
