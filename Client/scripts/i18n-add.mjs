/**
 * Merge a batch of keys into both catalogues at once.
 *
 * Input is a JSON file of { "dotted.key": ["french", "english"] }. Writing both sides from
 * one record is what keeps the files in parity by construction — adding to fr.json alone
 * is the exact mistake the parity check exists to catch.
 *
 * Usage: node scripts/i18n-add.mjs <batch.json>
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'src', 'i18n', 'locales');
const lockDir = join(localesDir, '.merge-lock');

/**
 * Whole-file read-modify-write, so two concurrent merges would otherwise lose one side's
 * keys. mkdir is atomic on every platform, which makes it a usable mutex here.
 */
async function withLock(run) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      mkdirSync(lockDir);
      try {
        return run();
      } finally {
        rmSync(lockDir, { recursive: true, force: true });
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out waiting for the locale lock');
}

const batch = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const load = (n) => JSON.parse(readFileSync(join(localesDir, `${n}.json`), 'utf8'));

function setDeep(root, dotted, value) {
  const parts = dotted.split('.');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
    node = node[part];
  }
  node[parts.at(-1)] = value;
}

const sortDeep = (node) =>
  Object.fromEntries(
    Object.entries(node)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? sortDeep(v) : v]),
  );

const added = await withLock(() => {
  // Re-read inside the lock: another merge may have landed since this process started.
  const fr = load('fr');
  const en = load('en');

  let count = 0;
  for (const [key, pair] of Object.entries(batch)) {
    const [frText, enText] = pair;
    setDeep(fr, key, frText);
    setDeep(en, key, enText);
    count += 1;
  }

  writeFileSync(join(localesDir, 'fr.json'), `${JSON.stringify(sortDeep(fr), null, 2)}\n`);
  writeFileSync(join(localesDir, 'en.json'), `${JSON.stringify(sortDeep(en), null, 2)}\n`);
  return count;
});

console.log(`merged ${added} keys`);
