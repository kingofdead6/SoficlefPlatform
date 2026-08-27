-- Drop the legacy generic JSON store.
--
-- `seed_content` held the raw extracted payloads so that pages not yet migrated onto their
-- own relational table could still read something. Every page now reads its own table, and
-- nothing in src/ referenced it, so the fallback is dead weight.
--
-- The data is reproducible: it was only ever a copy of seed/data/*.json, which remain in
-- the repository and are re-read by `npm run db:seed`.
DROP TABLE IF EXISTS "seed_content";
