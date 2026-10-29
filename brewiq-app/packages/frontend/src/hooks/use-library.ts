import type { RecipeIngredientRecord, RecipeRecord, YeastRecord } from '@rayfin-app/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ImportedIngredient, ImportedRecipe } from '@/lib/recipe-import';
import { getRayfinClient } from '@/lib/rayfin-client';
import { RECIPE_SEED } from '@/seed/recipes';
import { YEAST_SEED } from '@/seed/yeasts';

const YEAST_FIELDS = [
  'id', 'brand', 'code', 'name', 'form', 'species', 'category', 'flocculation',
  'attenuationMinPct', 'attenuationMaxPct', 'abvTolerance',
  'tempMinTenthsF', 'tempMaxTenthsF', 'notes', 'source', 'sourceUrl',
] as const;

const RECIPE_FIELDS = [
  'id', 'name', 'style', 'source', 'kitCode', 'batchSizeGal', 'ogPoints', 'abvTenths',
  'ibuTenths', 'primaryDaysMin', 'primaryDaysMax', 'totalWeeks', 'pitchTempMaxTenthsF',
  'yeastId', 'yeastNotes', 'timeline', 'instructions', 'sourceUrl', 'imageUrl', 'productUrl',
] as const;

const INGREDIENT_FIELDS = ['id', 'recipeId', 'kind', 'name', 'amount', 'timing', 'sortOrder'] as const;

/** The server rejects explicit nulls on create, so drop unset fields. */
function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as T;
}

export interface Library {
  yeasts: YeastRecord[];
  recipes: RecipeRecord[];
  ingredients: RecipeIngredientRecord[];
  yeastById: Map<string, YeastRecord>;
  recipeById: Map<string, RecipeRecord>;
  loading: boolean;
  error: string | null;
  seeding: boolean;
  /** Adds any library yeasts, recipes and ingredients that are missing. Returns a summary. */
  seed(): Promise<string>;
  /** Saves an imported recipe and its ingredients. Yeast data is never created or changed here. */
  saveImported(recipe: ImportedRecipe, yeastId?: string): Promise<RecipeRecord>;
  /** Links a recipe to a vendor image by URL; the image itself is not copied. */
  setRecipeImage(recipeId: string, imageUrl: string): Promise<void>;
  /** Updates fields and, when `lines` is given, replaces the ingredient list. */
  updateRecipe(id: string, patch: Partial<RecipeRecord>, lines?: ImportedIngredient[]): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  refresh(): Promise<void>;
}

export function useLibrary(): Library {
  const [yeasts, setYeasts] = useState<YeastRecord[]>([]);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await getRayfinClient()).data;
    const [y, r, i] = await Promise.all([
      data.Yeast.select([...YEAST_FIELDS]).first(1000).execute(),
      data.Recipe.select([...RECIPE_FIELDS]).first(1000).execute(),
      data.RecipeIngredient.select([...INGREDIENT_FIELDS]).first(1000).execute(),
    ]);
    const ys = (y as YeastRecord[]).slice().sort((a, b) =>
      `${a.brand} ${a.code}`.localeCompare(`${b.brand} ${b.code}`, undefined, { numeric: true })
    );
    setYeasts(ys);
    setRecipes((r as RecipeRecord[]).slice().sort((a, b) => a.name.localeCompare(b.name)));
    setIngredients(i as RecipeIngredientRecord[]);
    return { ys, rs: r as RecipeRecord[], is: i as RecipeIngredientRecord[] };
  }, []);

  const refresh = useCallback(async () => {
    try {
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    // Fetch on mount; `load` is stable so this runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      setError(null);
      const data = (await getRayfinClient()).data;
      const current = await load();
      const yeastKey = (y: { brand: string; code: string }) => `${y.brand}|${y.code}`;
      const haveYeast = new Map(current.ys.map((y) => [yeastKey(y), y.id]));
      let newYeasts = 0;
      for (const y of YEAST_SEED) {
        const existing = current.ys.find((e) => yeastKey(e) === yeastKey(y));
        if (existing) {
          // Backfill the category on yeasts loaded before it existed.
          if (!existing.category && y.category) {
            await data.Yeast.update({ id: existing.id }, { category: y.category });
          }
          continue;
        }
        const created = (await data.Yeast.create(defined(y))) as YeastRecord;
        haveYeast.set(yeastKey(y), created.id);
        newYeasts++;
      }
      const yeastIdByCode = new Map<string, string>();
      for (const y of YEAST_SEED) yeastIdByCode.set(y.code, haveYeast.get(yeastKey(y)) as string);

      const haveRecipe = new Map(current.rs.map((r) => [r.name, r.id]));
      let newRecipes = 0;
      let fixedRecipes = 0;
      for (const { ingredients: lines, yeastCode, ...r } of RECIPE_SEED) {
        if (haveRecipe.has(r.name)) {
          // Correct pitch temperatures loaded from an earlier seed.
          const prior = current.rs.find((e) => e.id === haveRecipe.get(r.name));
          if (prior && r.pitchTempMaxTenthsF != null && prior.pitchTempMaxTenthsF !== r.pitchTempMaxTenthsF) {
            await data.Recipe.update({ id: prior.id }, { pitchTempMaxTenthsF: r.pitchTempMaxTenthsF });
            fixedRecipes++;
          }
          continue;
        }
        const created = (await data.Recipe.create(
          defined({ ...r, yeastId: yeastIdByCode.get(yeastCode) })
        )) as RecipeRecord;
        haveRecipe.set(r.name, created.id);
        newRecipes++;
        for (const [n, line] of lines.entries()) {
          await data.RecipeIngredient.create(
            defined({ ...line, recipeId: created.id, sortOrder: n })
          );
        }
      }
      await load();
      return `Library loaded: added ${newYeasts} yeasts and ${newRecipes} recipes, corrected ${fixedRecipes} recipes.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setSeeding(false);
    }
  }, [load]);

  const saveImported = useCallback(
    async (recipe: ImportedRecipe, yeastId?: string) => {
      const data = (await getRayfinClient()).data;
      const { ingredients: lines, suggestedYeasts: _s, ...fields } = recipe;
      void _s;
      const created = (await data.Recipe.create(
        defined({ ...fields, yeastId })
      )) as RecipeRecord;
      for (const [n, line] of lines.entries()) {
        await data.RecipeIngredient.create(
          defined({ ...line, recipeId: created.id, sortOrder: n })
        );
      }
      await load();
      return created;
    },
    [load]
  );

  const setRecipeImage = useCallback(
    async (recipeId: string, imageUrl: string) => {
      const data = (await getRayfinClient()).data;
      await data.Recipe.update({ id: recipeId }, { imageUrl });
      await load();
    },
    [load]
  );

  const updateRecipe = useCallback(
    async (id: string, patch: Partial<RecipeRecord>, lines?: ImportedIngredient[]) => {
      const data = (await getRayfinClient()).data;
      const { id: _id, ...fields } = patch;
      void _id;
      const clean = defined(fields);
      if (Object.keys(clean).length > 0) await data.Recipe.update({ id }, clean);
      if (lines) {
        // Create the new lines before removing the old ones so a failure never leaves the recipe empty.
        const old = ingredients.filter((i) => i.recipeId === id);
        for (const [n, line] of lines.entries()) {
          await data.RecipeIngredient.create(defined({ ...line, recipeId: id, sortOrder: n }));
        }
        for (const o of old) await data.RecipeIngredient.delete({ id: o.id });
      }
      await load();
    },
    [load, ingredients]
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      const data = (await getRayfinClient()).data;
      for (const o of ingredients.filter((i) => i.recipeId === id)) {
        await data.RecipeIngredient.delete({ id: o.id });
      }
      await data.Recipe.delete({ id });
      await load();
    },
    [load, ingredients]
  );

  const yeastById = useMemo(() => new Map(yeasts.map((y) => [y.id, y])), [yeasts]);
  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  return { yeasts, recipes, ingredients, yeastById, recipeById, loading, error, seeding, seed, saveImported, setRecipeImage, updateRecipe, deleteRecipe, refresh };
}
