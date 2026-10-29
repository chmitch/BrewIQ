import type { RecipeIngredientRecord, RecipeRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { diffRecipe, ingredientsDiffer } from './recipe-diff';
import type { ImportedRecipe } from './recipe-import';

const current = {
  id: 'r1', name: 'Oatmeal Stout', style: 'Stout', batchSizeGal: 5, ogPoints: 1050,
  pitchTempMaxTenthsF: 780, kitCode: 'B12490',
} as RecipeRecord;

const next = {
  name: 'Oatmeal Stout', style: 'Stout', batchSizeGal: 5, ogPoints: 1050,
  pitchTempMaxTenthsF: 700, kitCode: null, totalWeeks: 6, ingredients: [],
} as ImportedRecipe;

describe('diffRecipe', () => {
  it('reports changed and new values and ignores ones the re-read did not find', () => {
    const changes = diffRecipe(current, next, 'https://img/x.jpg');
    expect(changes.map((c) => [c.key, c.before, c.after])).toEqual([
      ['totalWeeks', '—', '6'],
      ['pitchTempMaxTenthsF', '78.0°F', '70.0°F'],
      ['imageUrl', '—', 'https://img/x.jpg'],
    ]);
  });
});

describe('ingredientsDiffer', () => {
  it('compares lines in sort order', () => {
    const saved = [
      { id: 'b', recipeId: 'r1', kind: 'hop', name: 'Glacier', amount: '1 oz', timing: '60', sortOrder: 1 },
      { id: 'a', recipeId: 'r1', kind: 'fermentable', name: 'Gold LME', amount: '6 lb', timing: null, sortOrder: 0 },
    ] as RecipeIngredientRecord[];
    const same = [
      { kind: 'fermentable', name: 'Gold LME', amount: '6 lb', timing: null },
      { kind: 'hop', name: 'Glacier', amount: '1 oz', timing: '60' },
    ];
    expect(ingredientsDiffer(saved, same)).toBe(false);
    expect(ingredientsDiffer(saved, same.slice(0, 1))).toBe(true);
  });
});
