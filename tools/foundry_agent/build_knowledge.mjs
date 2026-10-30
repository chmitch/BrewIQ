// Generates the markdown knowledge files for the Foundry agent's vector store.
// Sources: functions/dist (playbook), shared/dist (BJCP stats), frontend/src/seed/yeasts.ts (yeast library).
// Run `npm run -w @rayfin-app/shared build` and `npm run -w @rayfin-app/functions build` first.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgs = resolve(here, '..', '..', 'brewiq-app', 'packages');
const out = join(here, 'knowledge');
mkdirSync(out, { recursive: true });

const { BREWING_PLAYBOOK } = await import(pathToFileURL(join(pkgs, 'functions', 'dist', 'brewing-playbook.js')));
const { BEER_STYLES } = await import(pathToFileURL(join(pkgs, 'shared', 'dist', 'beer-styles.js')));

const range = (r, d = 0) => (r ? `${r[0].toFixed(d)} to ${r[1].toFixed(d)}` : 'not specified');
const sg = (r) => (r ? `${r[0].toFixed(3)} to ${r[1].toFixed(3)}` : 'not specified');

writeFileSync(join(out, 'brewing-playbook.md'), `# Brewing playbook\n\n${BREWING_PLAYBOOK}\n`);

const styles = BEER_STYLES.map(
  (s) =>
    `## ${s.code} ${s.name}\nCategory: ${s.category}\nOG: ${sg(s.og)}\nFG: ${sg(s.fg)}\nABV: ${range(s.abv, 1)} %\nIBU: ${range(s.ibu)}\nSRM: ${range(s.srm, 1)}\n`,
);
writeFileSync(
  join(out, 'bjcp-styles.md'),
  `# BJCP 2021 beer style vital statistics\nNumeric ranges only. Source: BJCP 2021 Beer Style Guidelines, Copyright BJCP, Inc. (https://www.bjcp.org)\n\n${styles.join('\n')}`,
);

const seedSrc = readFileSync(join(pkgs, 'frontend', 'src', 'seed', 'yeasts.ts'), 'utf8')
  .replace(/^import .*$/m, '')
  .replace(/export type .*$/m, '')
  .replace(/export const YEAST_SEED[^=]*=/, 'return');
const yeasts = new Function(seedSrc)();
const f = (tenths) => (tenths == null ? 'n/a' : `${(tenths / 10).toFixed(1)}`);
const yeastMd = yeasts.map(
  (y) =>
    `## ${y.brand} ${y.code} ${y.name}\nForm: ${y.form}\nCategory: ${y.category ?? 'n/a'}\nSpecies: ${y.species ?? 'n/a'}\nFermentation temperature: ${f(y.tempMinTenthsF)} to ${f(y.tempMaxTenthsF)} F\nAttenuation: ${y.attenuationMinPct ?? 'n/a'} to ${y.attenuationMaxPct ?? 'n/a'} %\nFlocculation: ${y.flocculation ?? 'n/a'}\nAlcohol tolerance: ${y.abvTolerance ?? 'n/a'}\nSource: ${y.sourceUrl ?? y.source ?? 'n/a'}\n${y.notes ? `Notes: ${y.notes}\n` : ''}`,
);
writeFileSync(join(out, 'yeast-library.md'), `# Yeast library (manufacturer specifications)\n\n${yeastMd.join('\n')}`);

const require = createRequire(join(pkgs, 'frontend', 'package.json'));
const ts = require('typescript');
const recipeJs = ts.transpileModule(readFileSync(join(pkgs, 'frontend', 'src', 'seed', 'recipes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { RECIPE_SEED } = await import('data:text/javascript;base64,' + Buffer.from(recipeJs).toString('base64'));
const recipeMd = RECIPE_SEED.map(
  (r) =>
    `## ${r.name}\nStyle: ${r.style}\nSource: ${r.source}\nBatch size: ${r.batchSizeGal} gal\nOG: ${r.ogPoints ? (1 + r.ogPoints / 1000).toFixed(3) : 'n/a'}\nABV: ${r.abvTenths != null ? (r.abvTenths / 10).toFixed(1) : 'n/a'} %\nIBU: ${r.ibuTenths != null ? (r.ibuTenths / 10).toFixed(0) : 'n/a'}\nYeast (library code): ${r.yeastCode}\nYeast notes: ${r.yeastNotes ?? 'n/a'}\nTimeline: ${r.timeline ?? 'n/a'}\nIngredients:\n${r.ingredients.map((i) => `- ${i.kind}: ${i.name}, ${i.amount}${i.timing ? ` (${i.timing})` : ''}`).join('\n')}\n`,
);
writeFileSync(join(out, 'recipe-library.md'), `# Recipe library (extract kit recipes)\n\n${recipeMd.join('\n')}`);

console.log(`playbook, ${BEER_STYLES.length} styles, ${yeasts.length} yeasts, ${RECIPE_SEED.length} recipes -> ${out}`);
