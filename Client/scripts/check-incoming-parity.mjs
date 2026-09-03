/**
 * Proves the two _incoming catalogues carry the same key set.
 *
 * i18next plural suffixes are compared as-is: `_one` / `_other` must exist in both files,
 * because both French and English are two-form languages here. A key present on one side
 * only is the failure this script exists to catch.
 */
import { readFileSync } from 'node:fs';

const [frPath, enPath] = process.argv.slice(2);

function flatten(value, prefix = '', out = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, out);
    else out.push(path);
  }
  return out;
}

const fr = new Set(flatten(JSON.parse(readFileSync(frPath, 'utf8'))));
const en = new Set(flatten(JSON.parse(readFileSync(enPath, 'utf8'))));

const onlyFr = [...fr].filter((key) => !en.has(key)).sort();
const onlyEn = [...en].filter((key) => !fr.has(key)).sort();

console.log(`fr keys: ${fr.size}`);
console.log(`en keys: ${en.size}`);
console.log(`only in fr (${onlyFr.length}): ${onlyFr.join(', ') || '—'}`);
console.log(`only in en (${onlyEn.length}): ${onlyEn.join(', ') || '—'}`);
console.log(onlyFr.length === 0 && onlyEn.length === 0 ? 'PARITY OK' : 'PARITY FAILED');
process.exit(onlyFr.length === 0 && onlyEn.length === 0 ? 0 : 1);
