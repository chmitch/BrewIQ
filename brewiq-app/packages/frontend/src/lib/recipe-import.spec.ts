import type { YeastRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { matchYeasts, parseImportedRecipe } from './recipe-import';

const y = (brand: string, code: string): YeastRecord => ({ id: `${brand}${code}`, brand, code, name: code } as YeastRecord);
const LIB = [y('Fermentis', 'S-04'), y('Imperial', 'A01'), y('Omega', 'OYL-006'), y('Wyeast', '1098')];

describe('matchYeasts', () => {
  it('matches vendor naming variants and reports the rest', () => {
    const { matched, unmatched } = matchYeasts(
      [
        { brand: 'Fermentis', code: 'Safale S-04' },
        { brand: 'Imperial Yeast', code: 'A01' },
        { brand: 'Omega Yeast', code: 'OYL-006' },
        { brand: 'Wyeast', code: '9999' },
      ],
      LIB
    );
    expect(matched.map((m) => m.code)).toEqual(['S-04', 'A01', 'OYL-006']);
    expect(unmatched).toEqual([{ brand: 'Wyeast', code: '9999' }]);
  });
});

describe('parseImportedRecipe', () => {
  it('rejects results without ingredients', () => {
    expect(() => parseImportedRecipe('{"name":"x"}')).toThrow();
  });
});
