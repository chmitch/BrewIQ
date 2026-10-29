import type { RecipeIngredientRecord, RecipeRecord } from '@rayfin-app/shared';

import type { ImportedIngredient, ImportedRecipe } from './recipe-import';

export type RecipeFieldKey =
  | 'name' | 'style' | 'kitCode' | 'batchSizeGal' | 'ogPoints' | 'abvTenths' | 'ibuTenths'
  | 'primaryDaysMin' | 'primaryDaysMax' | 'totalWeeks' | 'pitchTempMaxTenthsF'
  | 'yeastNotes' | 'timeline' | 'instructions' | 'sourceUrl' | 'imageUrl';

export interface FieldChange {
  key: RecipeFieldKey;
  label: string;
  before: string;
  after: string;
}

type Show = (v: number | string) => string;

const tenths = (suffix: string): Show => (v) => `${(Number(v) / 10).toFixed(1)}${suffix}`;
const short: Show = (v) => {
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

const FIELDS: { key: RecipeFieldKey; label: string; show?: Show }[] = [
  { key: 'name', label: 'Name' },
  { key: 'style', label: 'Style' },
  { key: 'kitCode', label: 'Kit code' },
  { key: 'batchSizeGal', label: 'Batch (gal)' },
  { key: 'ogPoints', label: 'OG', show: (v) => (Number(v) / 1000).toFixed(3) },
  { key: 'abvTenths', label: 'ABV', show: tenths('%') },
  { key: 'ibuTenths', label: 'IBU', show: (v) => String(Math.round(Number(v) / 10)) },
  { key: 'primaryDaysMin', label: 'Primary days (min)' },
  { key: 'primaryDaysMax', label: 'Primary days (max)' },
  { key: 'totalWeeks', label: 'Total weeks' },
  { key: 'pitchTempMaxTenthsF', label: 'Pitch at or below', show: tenths('°F') },
  { key: 'yeastNotes', label: 'Yeast notes', show: short },
  { key: 'timeline', label: 'Timeline', show: short },
  { key: 'instructions', label: 'Instructions', show: short },
  { key: 'sourceUrl', label: 'Recipe PDF', show: short },
  { key: 'imageUrl', label: 'Image', show: short },
];

/** Fields where a re-read differs from the saved recipe. Values the re-read did not find are ignored. */
export function diffRecipe(
  current: RecipeRecord,
  next: ImportedRecipe,
  imageUrl?: string | null
): FieldChange[] {
  const incoming: Partial<Record<RecipeFieldKey, number | string | null | undefined>> = {
    ...next,
    imageUrl: imageUrl ?? next.imageUrl,
  };
  const out: FieldChange[] = [];
  for (const f of FIELDS) {
    const after = incoming[f.key];
    if (after == null || after === '') continue;
    const before = current[f.key];
    if (before === after) continue;
    const show = (v: number | string | null | undefined) =>
      v == null ? '—' : f.show ? f.show(v) : String(v);
    out.push({ key: f.key, label: f.label, before: show(before), after: show(after) });
  }
  return out;
}

const lineKey = (l: { kind: string; name: string; amount?: string | null; timing?: string | null }) =>
  [l.kind, l.name, l.amount ?? '', l.timing ?? ''].join('|');

export function ingredientsDiffer(
  current: RecipeIngredientRecord[],
  next: ImportedIngredient[]
): boolean {
  const a = current.slice().sort((x, y) => x.sortOrder - y.sortOrder).map(lineKey);
  const b = next.map(lineKey);
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}
