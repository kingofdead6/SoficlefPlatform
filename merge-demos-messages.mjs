/**
 * Merges public.demos into all three catalogues. Run once from the repo root:
 *   node merge-demos-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const additions = JSON.parse(readFileSync('messages-demos-additions.json', 'utf8'));

for (const [locale, patch] of Object.entries(additions)) {
  const path = `messages/${locale}.json`;
  const catalogue = JSON.parse(readFileSync(path, 'utf8'));
  catalogue.public = { ...catalogue.public, ...patch.public };
  writeFileSync(path, JSON.stringify(catalogue, null, 2) + '\n');
  console.log(`merged public.demos into ${path}`);
}
