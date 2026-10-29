// Builds brief fixtures for the analysis-agent evaluation.
// Run from brewiq-app after `npm run -w @rayfin-app/shared build`:
//   node ../tools/analysis_eval/make_briefs.mjs
import { buildBatchBrief } from '../../brewiq-app/packages/shared/dist/index.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOUR = 3_600_000;
const START = new Date('2026-07-01T12:00:00Z');
const ale = { name: 'Safale US-05', tempMinF: 59, tempMaxF: 75, attenuationMinPct: 78, attenuationMaxPct: 82, flocculation: 'Medium', abvTolerance: 'High (up to 12%)' };
const recipe = { name: 'American Pale Ale', style: 'American Pale Ale', ogPoints: 1052, abvTenths: 54, primaryDaysMin: 7, primaryDaysMax: 14 };

// Small deterministic wobble so the series is not perfectly smooth.
const wobble = (h, k) => Math.sin(h * 12.9898 + k) * 0.5;

function readings(hours, g, f) {
  return Array.from({ length: hours + 1 }, (_, h) => ({
    t: new Date(START.getTime() + h * HOUR),
    gravity: g(h) + wobble(h, 1) * 0.0004,
    tempF: f(h) + wobble(h, 2) * 0.4,
  }));
}
const sigmoid = (h, onset, span, og, fg) => fg + (og - fg) * (1 - Math.min(1, Math.max(0, (h - onset) / span)) ** 0.8);
const anomaly = (h, metric, value, deviation) => ({ t: new Date(START.getTime() + h * HOUR), metric, value, deviation });

const scenarios = [
  {
    id: 'healthy-complete',
    note: 'Textbook ferment that finished and held steady.',
    input: { batch: { name: 'APA #12', startDate: START }, recipe, yeast: ale, readings: readings(300, (h) => sigmoid(h, 14, 190, 1.052, 1.0105), (h) => 66 + 1.2 * Math.sin(h / 3.8)) },
  },
  {
    id: 'stalled-cold',
    note: 'Cold ferment that stopped early.',
    input: { batch: { name: 'APA #13', startDate: START }, recipe, yeast: ale, readings: readings(190, (h) => (h < 100 ? sigmoid(h, 16, 140, 1.052, 1.03) : 1.03 - 0.0001 * Math.min(h - 100, 30)), (h) => (h < 60 ? 66 : 57.5) + 0.8 * Math.sin(h / 3.8)) },
  },
  {
    id: 'hot-fast',
    note: 'Fermented far too warm, with large swings.',
    input: { batch: { name: 'APA #14', startDate: START }, recipe, yeast: ale, readings: readings(170, (h) => sigmoid(h, 6, 100, 1.052, 1.0095), (h) => 79 + 4.5 * Math.sin(h / 3.8)) },
  },
  {
    id: 'never-started',
    note: 'No gravity drop after three days, with noisy readings.',
    input: {
      batch: { name: 'APA #15', startDate: START }, recipe, yeast: ale,
      readings: readings(80, () => 1.052, (h) => 62 + 0.6 * Math.sin(h / 3.8)),
      anomalies: [anomaly(30, 'gravity', 1.066, 0.014), anomaly(51, 'temperature', 71.5, 9.2)],
    },
  },
  {
    id: 'cold-crash-candidate',
    note: 'Gravity is flat at the expected FG and temperature is steady.',
    input: { batch: { name: 'APA #16', startDate: START }, recipe, yeast: ale, readings: readings(250, (h) => sigmoid(h, 14, 150, 1.052, 1.0102), (h) => 67 + 0.9 * Math.sin(h / 3.8)) },
  },
  {
    id: 'over-attenuating',
    note: "Gravity is still creeping down well below the yeast's expected FG.",
    input: { batch: { name: 'APA #17', startDate: START }, recipe, yeast: ale, readings: readings(420, (h) => (h < 200 ? sigmoid(h, 14, 170, 1.052, 1.0102) : 1.0102 - (h - 200) * 0.00002), (h) => 68 + 1.3 * Math.sin(h / 3.8)) },
  },
];

const out = scenarios.map((s) => ({ id: s.id, note: s.note, brief: buildBatchBrief(s.input) }));
writeFileSync(fileURLToPath(new URL('./briefs.json', import.meta.url)), JSON.stringify(out, null, 1));
for (const s of out) {
  console.log(s.id, s.brief.gravity.phase, s.brief.gravity.current, s.brief.temperature.status, s.brief.findings.map((f) => f.code).join(','));
}
