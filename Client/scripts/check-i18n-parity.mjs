/**
 * Key-parity check for the two message catalogues.
 *
 * A key present in one file and missing from the other is a silent fallback: the English
 * UI quietly renders a French string and nothing errors. This walks both trees and
 * reports every asymmetry, exiting non-zero so it can gate a build.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'src', 'i18n', 'locales');

const load = (name) => JSON.parse(readFileSync(join(localesDir, `${name}.json`), 'utf8'));

/** Flatten to dotted leaf paths. Plural suffixes are ordinary keys and compared as such. */
function flatten(node, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out.add(path);
  }
  return out;
}

const fr = flatten(load('fr'));
const en = flatten(load('en'));

const missingInEn = [...fr].filter((key) => !en.has(key)).sort();
const missingInFr = [...en].filter((key) => !fr.has(key)).sort();

console.log(`fr.json: ${fr.size} keys`);
console.log(`en.json: ${en.size} keys`);

if (missingInEn.length === 0 && missingInFr.length === 0) {
  console.log('\nParity OK — 0 differences.');
  process.exit(0);
}

if (missingInEn.length) {
  console.log(`\nMissing in en.json (${missingInEn.length}):`);
  for (const key of missingInEn) console.log(`  - ${key}`);
}
if (missingInFr.length) {
  console.log(`\nMissing in fr.json (${missingInFr.length}):`);
  for (const key of missingInFr) console.log(`  - ${key}`);
}
process.exit(1);
