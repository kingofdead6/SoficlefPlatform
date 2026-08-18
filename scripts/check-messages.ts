/**
 * Message catalogue parity check (ADR-013).
 *
 *   npm run i18n:check
 *
 * `messages/fr.json` is the source of truth. Every other catalogue must mirror its key
 * structure exactly: a missing key would silently render as the key itself, and an
 * orphaned one is dead weight nobody will ever notice. ICU placeholders are compared too,
 * because a translation that drops `{days}` breaks at runtime, not at build time.
 */

import { readFileSync } from 'node:fs';

const SOURCE = 'fr';
const TARGETS = ['ar', 'en'] as const;

type Catalogue = Record<string, unknown>;

function read(locale: string): Catalogue {
  return JSON.parse(
    readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
  ) as Catalogue;
}

/** Flattens to dotted paths so a nested difference is reported where it happens. */
function flatten(value: unknown, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  if (typeof value === 'string') {
    entries.set(prefix, value);
    return entries;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, text] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        entries.set(path, text);
      }
    }
  }
  return entries;
}

/** ICU argument names, ignoring plural category labels inside the braces. */
function placeholders(message: string): Set<string> {
  const found = new Set<string>();
  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(?:,|\})/g)) {
    found.add(match[1]);
  }
  return found;
}

const source = flatten(read(SOURCE));
const problems: string[] = [];

for (const locale of TARGETS) {
  const target = flatten(read(locale));

  for (const key of source.keys()) {
    if (!target.has(key)) problems.push(`${locale}: missing key "${key}"`);
  }
  for (const key of target.keys()) {
    if (!source.has(key)) problems.push(`${locale}: orphaned key "${key}" (not in ${SOURCE})`);
  }

  for (const [key, message] of source) {
    const translated = target.get(key);
    if (translated === undefined) continue;

    const expected = placeholders(message);
    const actual = placeholders(translated);
    for (const name of expected) {
      if (!actual.has(name)) problems.push(`${locale}: "${key}" drops the {${name}} placeholder`);
    }
    for (const name of actual) {
      if (!expected.has(name))
        problems.push(`${locale}: "${key}" adds an unknown {${name}} placeholder`);
    }
    if (translated.trim() === '') problems.push(`${locale}: "${key}" is empty`);
  }
}

if (problems.length > 0) {
  console.error(`\n✖ message catalogues are out of sync (${problems.length} problem(s)):\n`);
  for (const problem of problems) console.error(`   ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✔ ${TARGETS.length + 1} catalogues in sync — ${source.size} keys, placeholders included\n`,
);
