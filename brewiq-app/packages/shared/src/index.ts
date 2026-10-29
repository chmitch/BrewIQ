/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */
export interface BatchRecord {
  id: string;
  name: string;
  startDate: Date;
  /** Target original gravity in points (1.050 SG = 1050). */
  targetOGPoints: number;
  yeast: string;
  /** Unset while the batch is active. */
  endDate?: Date | null;
  owner_id: string;
  /** Final metrics, set when the batch is completed. Gravity in points, ABV and temperatures in tenths. */
  ogPoints?: number | null;
  fgPoints?: number | null;
  abvTenths?: number | null;
  attenuationPct?: number | null;
  minTempTenthsF?: number | null;
  maxTempTenthsF?: number | null;
  avgTempTenthsF?: number | null;
  readings?: number | null;
  /** Optional links into the shared recipe / yeast library. */
  recipeId?: string | null;
  yeastId?: string | null;
}

/** Manufacturer yeast spec. Temperatures in tenths of °F. */
export interface YeastRecord {
  id: string;
  brand: string;
  code: string;
  name: string;
  form: string;
  species?: string | null;
  /** What it is used for: Beer, Wine, Mead, Cider, Wild & Sour, ... */
  category?: string | null;
  flocculation?: string | null;
  attenuationMinPct?: number | null;
  attenuationMaxPct?: number | null;
  abvTolerance?: string | null;
  tempMinTenthsF?: number | null;
  tempMaxTenthsF?: number | null;
  notes?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
}

/** Commercial kit recipe. Gravity in points; ABV, IBU and temperatures in tenths. */
export interface RecipeRecord {
  id: string;
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
  yeastId?: string | null;
  yeastNotes?: string | null;
  timeline?: string | null;
  instructions?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
}

export interface RecipeIngredientRecord {
  id: string;
  recipeId: string;
  kind: string;
  name: string;
  amount?: string | null;
  timing?: string | null;
  sortOrder: number;
}

export type UniversalAppSchema = {
  Batch: BatchRecord;
  Yeast: YeastRecord;
  Recipe: RecipeRecord;
  RecipeIngredient: RecipeIngredientRecord;
};

export * from './batch-brief.js';
