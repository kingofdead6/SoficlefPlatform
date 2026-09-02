/**
 * Find French text still sitting in JSX.
 *
 * Deliberately narrow, because the codebase is *about* a French company: identifiers,
 * imports, comments, className strings, API field names (titleFr, nameFr …) and console
 * calls are all excluded, so a hit is a real user-visible string rather than noise.
 *
 * Usage: node scripts/find-french.mjs [dir...]
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const roots = process.argv.slice(2);
const dirs = roots.length ? roots : ['src/pages', 'src/components'];
const files = dirs.flatMap((d) => globSync(`${d}/**/*.jsx`));

/** Accented letters, plus common unaccented French words that read as UI copy. */
const ACCENTED = /[àâäçéèêëîïôöùûüÀÂÄÇÉÈÊËÎÏÔÖÙÛÜœ]/;
const WORDS =
  /\b(Aucun|Aucune|Chargement|Enregistrer|Annuler|Retour|Voir|Impossible|Ajouter|Supprimer|Modifier|Rechercher|Nouveau|Nouvelle|Tous|Toutes|Valider|Fermer|Ouvrir|Envoyer|Confirmer|Sélectionner|Choisir|Statut|Poste|Nom|Prénom|Date|Titre|Actions|Détails|Notes|Total|Oui|Non|Erreur|Charger|Suivant|Précédent|des|les|une|pour|avec|dans|sur|par|est|sont|vous|votre|aucun)\b/;

/** Lines that are code or comment rather than copy. */
function isNoise(line) {
  const t = line.trim();
  return (
    t.startsWith('*') ||
    t.startsWith('//') ||
    t.startsWith('/*') ||
    /^import\s|^export\s+\{/.test(t) ||
    /className=|console\.(log|warn|error|info|debug)/.test(t) ||
    // API-sourced French content fields render as-is in both languages.
    /\b\w+(Fr)\b\s*[:,)}]/.test(t) ||
    /\.\w*Fr\b/.test(t)
  );
}

let total = 0;
const perFile = new Map();

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (isNoise(line)) return;
    // Only consider the parts of a line that can reach the screen: JSX text and quoted
    // strings in translatable attributes.
    const candidates = [
      ...line.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g),
      ...line.matchAll(/(?:aria-label|title|placeholder|alt|label|aria-description)=["']([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const text of candidates) {
      if (!/[A-Za-zÀ-ÿ]{2}/.test(text)) continue;
      if (ACCENTED.test(text) || WORDS.test(text)) {
        hits.push(`${i + 1}: ${text.trim().slice(0, 90)}`);
        break;
      }
    }
  });
  if (hits.length) {
    perFile.set(file, hits);
    total += hits.length;
  }
}

const sorted = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [file, hits] of sorted) {
  console.log(`\n${file} (${hits.length})`);
  for (const h of hits.slice(0, 6)) console.log(`   ${h}`);
  if (hits.length > 6) console.log(`   … ${hits.length - 6} more`);
}
console.log(`\nTOTAL: ${total} lines across ${perFile.size} files`);
