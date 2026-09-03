import fr from './src/i18n/locales/fr.json' with { type: 'json' };
import en from './src/i18n/locales/en.json' with { type: 'json' };
const walk = (o, p = '', out = []) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key, out); else out.push(key);
  }
  return out;
};
const F = new Set(walk(fr)), E = new Set(walk(en));
const missingEn = [...F].filter(k => !E.has(k));
const missingFr = [...E].filter(k => !F.has(k));
console.log(`fr=${F.size} en=${E.size}`);
console.log('missing in en:', missingEn.length ? missingEn.slice(0,10) : 'none');
console.log('missing in fr:', missingFr.length ? missingFr.slice(0,10) : 'none');
console.log(missingEn.length + missingFr.length === 0 ? 'PARITY OK' : 'PARITY BROKEN');
