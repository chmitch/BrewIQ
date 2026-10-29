import type { YeastRecord } from '@rayfin-app/shared';

export interface ImportedIngredient {
  kind: string;
  name: string;
  amount?: string | null;
  timing?: string | null;
}

export interface SuggestedYeast {
  brand?: string | null;
  code?: string | null;
  name?: string | null;
}

/** Shape written by the RecipeImport notebook. Gravity in points; ABV, IBU and temperatures in tenths. */
export interface ImportedRecipe {
  name: string;
  style: string;
  source?: string | null;
  kitCode?: string | null;
  batchSizeGal: number;
  ogPoints: number;
  abvTenths?: number | null;
  ibuTenths?: number | null;
  primaryDaysMin?: number | null;
  primaryDaysMax?: number | null;
  totalWeeks?: number | null;
  pitchTempMaxTenthsF?: number | null;
  yeastNotes?: string | null;
  suggestedYeasts?: SuggestedYeast[] | null;
  timeline?: string | null;
  instructions?: string | null;
  ingredients: ImportedIngredient[];
  sourceUrl?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
}

export function parseImportedRecipe(json: string): ImportedRecipe {
  const r = JSON.parse(json) as ImportedRecipe;
  if (!r || typeof r.name !== 'string' || !Array.isArray(r.ingredients)) {
    throw new Error('The import returned an unexpected result.');
  }
  return r;
}

function brandKey(brand: string): string {
  const b = brand.toLowerCase();
  if (b.includes('fermentis') || b.includes('safale') || b.includes('saflager')) return 'fermentis';
  return b.replace(/\byeast\b/g, '').trim().split(/\s+/)[0] ?? '';
}

function codeKey(code: string): string {
  return code.toLowerCase().replace(/^(safale|saflager|safbrew)\s+/, '').trim();
}

/**
 * Finds library yeasts for the recipe's suggestions. Vendor data in the library is authoritative,
 * so suggestions are only matched, never created or used to change a yeast.
 */
export function matchYeasts(
  suggested: SuggestedYeast[] | null | undefined,
  library: YeastRecord[]
): { matched: YeastRecord[]; unmatched: SuggestedYeast[] } {
  const matched: YeastRecord[] = [];
  const unmatched: SuggestedYeast[] = [];
  for (const s of suggested ?? []) {
    const hit =
      s.brand && s.code
        ? library.find((y) => brandKey(y.brand) === brandKey(s.brand!) && codeKey(y.code) === codeKey(s.code!))
        : undefined;
    if (hit) {
      if (!matched.includes(hit)) matched.push(hit);
    } else {
      unmatched.push(s);
    }
  }
  return { matched, unmatched };
}
